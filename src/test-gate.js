// ######################        Globals          ######################
const MOUSE_IGNORE_GATE = true;
const MOUSE_IGNORE_DISTANCE = true;

const MONITORING_SERVER_ADDRESS = '0.0.0.0';
const MONITORING_SERVER_PORT = 2222;

const TRACKING_COLORS = ['acacac', '535353'];

const GATE_STOPWATCH_MUTE = true;
const GATE_FREQUENCY = 10; // ms
const GATE_COMPRESSOR = 2;

const GATE_SIZE = { width: 10, height: 110 };
const GATE_POSITION = { x: 480, y: 164 };

const DISTANCE_STOPWATCH_MUTE = true;
const DISTANCE_FREQUENCY = 10; // ms
const DISTANCE_COMPRESSOR = 2;
const DISTANCE_TIMEOUT = 2000;

const DISTANCE_POSITION = { x: 90, y: 278 };
const DISTANCE_SIZE = { width: 270, height: 1 };

const MACHINE_LOCATION = __dirname + '/../machine';

const MACHINE_NETWORK_GENERATIONS = 12;
const MACHINE_NETWORK_INPUT = 5;
const MACHINE_NETWORK_LAYER = 4;
const MACHINE_NETWORK_OUTPUT = 1;

const MACHINE_MIN_WIDTH = 0;
const MACHINE_MIN_HEIGHT = 0;
const MACHINE_MIN_DISTANCE = 0;
const MACHINE_MIN_SPEED = 0;

const MACHINE_MAX_WIDTH = 50;
const MACHINE_MAX_HEIGHT = 50;
const MACHINE_MAX_DISTANCE = DISTANCE_SIZE.width;
const MACHINE_MAX_SPEED = 0.5;
const DISTANCE_MAX_ORIGIN = GATE_SIZE.height;


// ######################        /Globals          ######################

// ######################        Utils          ######################
const uuid = require('uuid');
const robotjs = require('robotjs');

robotjs.setMouseDelay(0);
robotjs.setKeyboardDelay(0);

const Controller = () => {
    const context = {
        jumpToggle: null,
        crouchToggle: null,
    };

    return Object.assign({}, {
        jump: () => {
            if (!context.jumpToggle) {
                // console.log('JUMP');
                robotjs.keyTap('up');
                context.jumpToggle = setTimeout(() => {
                    context.jumpToggle = null;
                }, 1000/60)
            }

            clearTimeout(context.crouchToggle);
        },
        crouch: () => {
            if (!context.crouchToggle) {
                // console.log('CROUCH');
                robotjs.keyToggle('down', 'down');
            }

            clearTimeout(context.crouchToggle);
            clearTimeout(context.jumpToggle);

            context.crouchToggle = setTimeout(() => {
                robotjs.keyToggle('down', 'up')
                context.crouchToggle = null;
            }, 1000)
        }
    })
};

const MoveMouse = (ignore) => (x, y) => {
    ignore ? null : robotjs.moveMouse(x, y);
}

const Capture = (x, y, width, height) => {
    const screenCapture = robotjs.screen.capture(x, y, width, height);
    const converters = {
        relative: { x: (absolute) => absolute - x, y: (absolute) => absolute - y },
        absolute: { x: (relative) => x + relative, y: (relative) => y + relative }
    }
    const ratio = { x: screenCapture.width / width, y: screenCapture.height / height };

    return {
        screen: screenCapture,
        colorAt: (x, y) => { return screenCapture.colorAt(x * ratio.x, y * ratio.y) },
        ratio,
        converters
    }
}

const saveCapture = async (capture, path) => {
    return new Promise((resolve, reject) => {
        try {
            const filename = `${Date.now()}`;
            const pixelsShit = [];
            for (let y = 0; y < capture.height; y++) {
                const captured = [];
                for (let x = 0; x < capture.width; x++) {
                    pixelsShit.push(`<div style="width:1px;height:1px;position:absolute;top:${y}px;left:${x}px;background:#${capture.colorAt(x, y)};"></div>`);
                }
            }

            require('fs').mkdirSync(path, { recursive: true });
            require('fs').writeFileSync(`${path}/${filename}.html`, `<html><body style="background:red;">${pixelsShit.join('')}</body></html>`);
            resolve(true);
        } catch (e) {
            console.error(e);
            reject(e);
        }
    });
}

const converters = {
    nanoseconds: (milliseconds) => milliseconds * 1000000,
    milliseconds: (nanoseconds) => nanoseconds / 1000000
}
// ######################        /Utils          ######################

// ######################        Domain          ######################

// Monitoring
const udp = require('dgram');

const MONITORING_TYPES = {
    stopwatch: 'stopwatch',
    logger: 'logger'
};
const Monitoring = (address, port) => {
    
    const monitoringClient = ((client, address, port) => (data) => {
        const buffer = Buffer.from(JSON.stringify(data));

        client.send(buffer, port, address)
    })(udp.createSocket('udp4'), address, port);

    return {
        logger: ((client) => (content, channel = 'main') => {
            client({ type: MONITORING_TYPES.logger, name: channel, content })
        })(monitoringClient),
        stopwatch: ((client) => async (name, config, func) => {
            const start = process.hrtime.bigint();
    
            const data = await func();

            const end = process.hrtime.bigint();

            const measure = Number(end - start); // nano seconds

            if (!config.mute)
                client({ type: MONITORING_TYPES.stopwatch, name, measure, max: config.max, threshold: config.threshold });

            return data;
        })(monitoringClient)
    };
}

const { EventEmitter } = require('events');

// Sensors
const Gate = (config, monitoring) => {
    const context = {
        emitter: new EventEmitter(),
        interval: null,
        state: {
            match: false,
            positions: [],
            activate: { on: null, off: null },
            width: 0
        }
    };
    
    function clearContext() {
        context.interval = null;
        context.state.match = false;
        context.state.positions = [];
        context.activate = { on: null, off: null };
        context.state.width = 0;
    }
    
    function computeState() {
        context.state.positions.sort((a, b) =>  b-a);
        
        const origin = config.size.height - context.state.positions.shift(); 
        const height = config.size.height - context.state.positions.pop() - origin;
        const duration = context.state.activate.off - context.state.activate.on;
        const width = captureWidth(origin, height);
        
        return ({ origin, height, width, speed: width/duration });
    }
    
    function captureWidth(origin, height) {
        const x = config.position.x - 100;
        const y = config.position.y + config.size.height - origin - (height / 2);
        const capture = Capture(x, y, 100, 1);

        context.emitter.emit('capture_terminate', capture);
        
        let tolerance = 5;
        let width = 0;
        for (let i = 99 / config.compressor; i >= 0; i--) {
            if (tolerance === 0) break;
            
            if(config.tracker.colors.includes(capture.colorAt(i * config.compressor, 0))) {
                width++;
                tolerance = 5;
            } else if (width > 0) {
                tolerance--;
                width++;
            }
        }
        
        return width;
    }
    
    function initialize(y) {
        context.state.positions.push(y);
        context.state.width++;
        
        if (!context.state.match) {
            context.state.match = true;
            context.state.activate.on = Date.now();
            
            context.emitter.emit('initialize');
        }
    }
    
    function terminate() {
        context.state.activate.off = Date.now();
        
        context.emitter.emit('terminate', computeState());
        clearContext();
    }
    const self = () => Object.assign({}, {
        'start': _start,
        'stop': _stop,
        'on': _on
    });
    
    function _start() {
        monitoring.logger(`[GATE] -> start`);
        context.interval = setInterval(() => {
            monitoring.stopwatch('Gate', config.monitoring.stopwatch, () => {
                const capture = Capture(config.position.x, config.position.y, config.size.width, config.size.height);
                
                
                const heightCompressed = (config.size.height - 1) / config.compressor;
                const widthCompressed = (config.size.width - 1) / config.compressor;
                const trackers = 2;
                
                let localMatch = false;
                for (let y = 0; y/config.compressor < heightCompressed/trackers; y++) {
                    for (let x = 0; x/config.compressor < widthCompressed; x++) {
                        
                        MoveMouse(MOUSE_IGNORE_GATE)(capture.converters.absolute.x(x), capture.converters.absolute.y(y));
                        MoveMouse(MOUSE_IGNORE_GATE)(capture.converters.absolute.x(x), capture.converters.absolute.y((config.size.height - 1) - y));
                        const [top, bottom] = [config.tracker.colors.includes(capture.colorAt(x, y)), config.tracker.colors.includes(capture.colorAt(x, (config.size.height - 1) - y))];
                        if (top || bottom) {
                            localMatch = true;
                            
                            initialize(top ? y : config.size.height - y);
                        }
                    }
                }

                if (localMatch) context.emitter.emit('capture_match', capture);
                
                if (context.state.match && !localMatch) { terminate() }
            })
        }, config.frequency);

        return self();
    }
    
    function _stop() {
        monitoring.logger(`[GATE] -> stop`);

        clearInterval(context.interval);
        clearContext();

        return self();
    }
    
    function _on(e, func) {
        monitoring.logger(`[GATE] -> register on(${e})`);

        context.emitter.on(e, func);
        
        return self();
    }
    
    return self();
};

const Distance = (config, monitoring) => {
    const context = {
        emitter: new EventEmitter(),
        interval: null,
        timeout: null,
        state: {
            targets: null,
            current: null,
            distance: null,
            passthrough: false
        }
    };

    function clearContext() {
        context.interval = null;
        context.timeout = null;
        context.state.targets = null;
        context.state.current = null;
        context.state.distance = null;
        context.state.passthrough = false;
    }

    function parseCapture(capture) {
        for (let xCompressed = 0; xCompressed < config.size.width / config.compressor; xCompressed++) {
            const x = xCompressed * config.compressor;
            
            if (config.tracker.colors.includes(capture.colorAt(x, 0))) {
                MoveMouse(MOUSE_IGNORE_DISTANCE)(capture.converters.absolute.x(x), capture.converters.absolute.y(0));

                return x;
            }
        }

        return config.size.width;
    }

    function initTimeout() {
        clearTimeout(context.timeout);
        context.timeout = setTimeout(() => {
            context.emitter.emit('timeout');
        }, config.timeout);
    }

    const self = () => Object.assign({}, {
        'start': _start,
        'stop': _stop,
        'on': _on
    });

    function _start(targets) {
        monitoring.logger(`[DISTANCE] -> start`);

        context.state.targets = targets;
        context.interval = setInterval(() => {
            monitoring.stopwatch('Distance', config.monitoring.stopwatch, () => {
                if (!context.state.current && (!context.state.targets.length)) return;
                
                if (!context.state.current) {
                    context.state.current = context.state.targets.shift();
                    context.emitter.emit('initialize', context.state.current);

                    initTimeout();
                }

                const capture = Capture(config.position.x, config.position.y - (context.state.current.height / 2 + context.state.current.origin), config.size.width, 1);

                context.emitter.emit('capture', capture);

                context.state.distance = parseCapture(capture);

                if (!context.state.passthrough && 5 > context.state.distance) {
                    context.state.passthrough = true ;
                } else if (context.state.passthrough && context.state.distance > 5) {
                    context.state.passthrough = false;
                    context.state.current = null;
                    
                    context.emitter.emit('scored');
                } else if (!context.state.passthrough && context.state.distance > 5) {
                    context.emitter.emit('distance', context.state.distance);
                }
            });
        }, config.frequency);

        return self();
    }

    function _stop() {
        monitoring.logger(`[DISTANCE] -> stop`);

        clearTimeout(context.timeout);
        clearInterval(context.interval);
        clearContext();

        return self();
    }

    function _on(e, func) {
        monitoring.logger(`[DISTANCE] -> register on(${e})`);
        context.emitter.on(e, func);

        return self();
    }

    return self();
};

// Terminal
const readline = require('readline');

const Terminal = (config, monitoring) => {
    const context = {
        emitter: new EventEmitter(),
        state: null
    };

    function clearContext() {
        context.state = null;
    }

    function displayHelp() {
        console.log(JSON.stringify({
            'Press s': 'Start learning',
            'Press S': 'Stop learning',
            'Press r': 're-Start learning',
            // 'Press p': 'Start game with best known genome',
            'Press q': 'Quit game', 
        }, null, 2));
    }

    const self = () => Object.assign({}, {
        'context': _context,
        'start': _start,
        'stop': _stop,
        'quit': _quit,
        'on': _on,
        'emit': _emit
    });

    function _context(func) {
        displayHelp();

        readline.emitKeypressEvents(process.stdin);
        process.stdin.setRawMode(true);

        context.state = func(self());

        process.stdin.on('keypress', ((args) => (str, key) => { 
            if (['?', 'h'].includes(str)) displayHelp()

            if (str === 'q') context.emitter.emit('quit', ...args, self())
            if (str === 's') context.emitter.emit('start', ...args, self())
            if (str === 'S') context.emitter.emit('stop', ...args, self())
            if (str === 'r') context.emitter.emit('reload', ...args, self())
        })(context.state))
    }

    function _start() {
        monitoring.logger('[TERMINAL] -> start');
    }

    function _stop() {
        monitoring.logger('[TERMINAL] -> stop');
    }

    function _quit() {
        monitoring.logger('[TERMINAL] -> quit');
        
        process.stdin.setRawMode(false);
        clearContext();
    }

    function _on(e, func) {
        monitoring.logger(`[TERMINAL] -> register on(${e})`);
        context.emitter.on(e, func);

        return self();
    }

    function _emit(e, ...data) {
        monitoring.logger(`[TERMINAL] -> emit on(${e})`);
        context.emitter.emit(e, ...data);

        return self();
    }

    return self();
}

// Machine
const { Architect, Network } = require('synaptic');
const fs = require('fs');
const cloneDeep = require('lodash/cloneDeep');

const Machine = (config, controller, monitoring) => {
    const genetics = {
        crossOver: (netA, netB) => {
            // Swap (50% prob.)
            if (Math.random() > 0.5) {
                var tmp = netA;
                netA = netB;
                netB = tmp;
            }
            
            // Clone network
            netA = cloneDeep(netA);
            netB = cloneDeep(netB);
            
            // Cross over data keys
            genetics.crossOverDataKey(netA.neurons, netB.neurons, 'bias');
            
            return netA;
        },
        crossOverDataKey: (a, b, key) => {
            var cutLocation = Math.round(a.length * Math.random());
            
            var tmp;
            for (var k = cutLocation; k < a.length; k++) {
                // Swap
                tmp = a[k][key];
                a[k][key] = b[k][key];
                b[k][key] = tmp;
            }
        },
        mutate: (net) => {
            // Mutate
            genetics.mutateDataKeys(net.neurons, 'bias', 0.2);
            
            genetics.mutateDataKeys(net.connections, 'weight', 0.2);
            
            return net;
        },
        mutateDataKeys: (a, key, mutationRate) => {
            for (var k = 0; k < a.length; k++) {
                // Should mutate?
                if (Math.random() > mutationRate) {
                continue;
                }
            
                a[k][key] += a[k][key] * (Math.random() - 0.5) * 3 + (Math.random() - 0.5);
            }
        }
    };

    const networks = {
        'process': {
            location: ((location) => `${location}/process`)(config.location),
            initialize: () => {
                for (let i = 0; i < config.network.generations; i++) {
                    const network = new Architect.Perceptron(config.network.input, config.network.layer, config.network.output);
    
                    // write network into file
                    networks.process.store(network);
                }
            },
            pick: () => {
                const location = networks.process.location;

                const filename = fs.readdirSync(location).filter(e => e.match('.network')).slice(0, 1);
                const path = `${location}/${filename}`;

                return { location: path, network: Network.fromJSON(JSON.parse(fs.readFileSync(path))) };
            },
            store: (network) => {
                const location = networks.process.location;
                const filename =  `${uuid.v4()}.network`;
                
                const path = `${location}/${filename}`;

                if (!fs.existsSync(location)) { fs.mkdirSync(location, { recursive: true }) }

                fs.writeFileSync(path,  JSON.stringify(network));
            },
            isEmpty: () => {
                const location = networks.process.location;
                return !(fs.existsSync(location) && !!fs.readdirSync(location).filter(e => e.match('.network')).length);
            }
        },
        'processed': {
            location: ((location) => `${location}/processed`)(config.location),
            meddle: () => {
                // pick & archive LEGACY 2 bests processed networks from PROCESSED
                const location = networks.processed.location;
                const score = (filename) => Number(filename.match(/[\d]{6}/).shift());

                const [best1, best2] = fs.readdirSync(location)
                    .filter(e => e.match('.network'))
                    .sort((a, b) =>  score(b) - score(a))
                    .slice(0, 2)
                    .map(filename => Object.assign({}, { score: score(filename), network: JSON.parse(fs.readFileSync(`${location}/${filename}`)) }));

                networks.legacy.store(best1.network, best1.score);
                networks.legacy.store(best2.network, best2.score);

                networks.processed.clean();

                const mutation = genetics.mutate(genetics.crossOver(best1.network, best2.network));
                networks.process.store(mutation);

                for (let i = 0; i < config.network.generations - 1; i++) {
                    networks.process.store(genetics.mutate(mutation));
                }
            },
            clean: () => {
                const location = networks.processed.location;

                fs.readdirSync(location)
                    .filter(e => e.match('.network'))
                    .map(e => fs.unlinkSync(`${location}/${e}`))
            },
            store: (processLocation, network, score) => {
                const location = networks.processed.location;
                const scoreString = String(score);
                const placeholdder = '000000';

                const filename =  `${placeholdder.slice(0, placeholdder.length - scoreString.length)}${scoreString}-${uuid.v4()}.network`;
                const path = `${location}/${filename}`;

                if (!fs.existsSync(location)) { fs.mkdirSync(location, { recursive: true }) }

                fs.writeFileSync(path,  JSON.stringify(network));

                fs.unlinkSync(processLocation);
            }
        },
        'legacy': {
            location: ((location) => `${location}/legacy`)(config.location),
            store: (network, score) => {
                const location = networks.legacy.location;
                const scoreString = String(score);
                const placeholdder = '000000';

                const filename =  `${placeholdder.slice(0, placeholdder.length - scoreString.length)}${scoreString}-${uuid.v4()}.network`;
                const path = `${location}/${filename}`;

                if (!fs.existsSync(location)) { fs.mkdirSync(location, { recursive: true }) }

                fs.writeFileSync(path,  JSON.stringify(network));
            }
        }
    };

    const context = {
        network: null,
        location: null,
        state: {
            score: 0,
            inputs: {
                width: null,
                height: null,
                speed: null,
                origin: null,
                distance: null
            }
        }
    };

    function clearContext() {
        context.network = null;
        context.location = null;
        context.state.score = 0;
        context.state.inputs = {
            width: null,
            height: null,
            speed: null,
            origin: null,
            distance: null
        };
    }

    function computeInputs(rawInputs) {
        Object.keys(rawInputs).map(k => {
            context.state.inputs[k] = rawInputs[k] / config.inputs.max[k];
        })
    }

    const self = () => Object.assign({}, {
        'start': _start,
        'stop': _stop,
        'initialize': _initialize,
        'play': _play,
        'score': _score
    });

    function _start() {
        monitoring.logger(`[MACHINE] -> start`);

        if (networks.process.isEmpty()) { networks.process.initialize() }

        const data = networks.process.pick();

        context.network = data.network;
        context.location = data.location;
    }

    function _stop() {
        monitoring.logger(`[MACHINE] -> stop`);
        console.log(context.state.score);
        networks.processed.store(context.location, context.network, context.state.score);

        if (networks.process.isEmpty()) {
            networks.processed.meddle();
        }

        clearContext();
    }

    function _initialize(rawInputs) {
        monitoring.logger(`[MACHINE] -> initialize`);

        computeInputs(rawInputs);

        monitoring.logger(`[MACHINE] -> inputs ${JSON.stringify(context.state.inputs)}`);
    }
    
    function _play(rawInputs) {
        computeInputs(rawInputs);
        
        // activate network
        const inputs = Object.values(context.state.inputs);
        const [output] = context.network.activate(inputs);
        // monitoring.play(output);

        if (output > 0.55) controller.jump();
        if (output < 0.45) controller.crouch();
    }

    function _score() {
        monitoring.logger(`[MACHINE] -> score`);
        console.log('+score');
        context.state.score++;
    }
    

    return self();
}

// ######################        /Domain          ######################

// ######################        Config          ######################

// Config Sensors Monitoring
const configMonitoring = {
    gate: { stopwatch: { mute: GATE_STOPWATCH_MUTE, max: converters.nanoseconds(GATE_FREQUENCY), threshold: converters.nanoseconds(GATE_FREQUENCY * 0.7) } },
    distance: { stopwatch: { mute: DISTANCE_STOPWATCH_MUTE, max: converters.nanoseconds(DISTANCE_FREQUENCY), threshold: converters.nanoseconds(DISTANCE_FREQUENCY * 0.7) } },
    terminal: {},
    machine: {}
}

// Config
const config = {
    gate: { frequency: GATE_FREQUENCY, compressor: GATE_COMPRESSOR, position: GATE_POSITION, size: GATE_SIZE, tracker: { colors: TRACKING_COLORS }, monitoring: configMonitoring.gate },
    distance: { frequency: DISTANCE_FREQUENCY, compressor: DISTANCE_COMPRESSOR, timeout: DISTANCE_TIMEOUT, position: DISTANCE_POSITION, size: DISTANCE_SIZE, tracker: { colors: TRACKING_COLORS }, monitoring: configMonitoring.distance },
    terminal: { monitoring: configMonitoring.terminal },
    machine: { location: MACHINE_LOCATION, network: { generations: MACHINE_NETWORK_GENERATIONS, input: MACHINE_NETWORK_INPUT, layer: MACHINE_NETWORK_LAYER, output: MACHINE_NETWORK_OUTPUT }, inputs: { max: { width: MACHINE_MAX_WIDTH, height: MACHINE_MAX_HEIGHT, origin: DISTANCE_MAX_ORIGIN, distance: MACHINE_MAX_DISTANCE, speed: MACHINE_MAX_SPEED } }, monitoring: configMonitoring.machine }
}

// ######################        /Config          ######################

// ######################        Execution          ######################
const monitoring = Monitoring(MONITORING_SERVER_ADDRESS, MONITORING_SERVER_PORT);

const capturesGate = [];
const capturesDistance = [];

// Useful for debug
async function saveCaptures() {
    const uniq = uuid.v4();

    if (capturesGate.length) monitoring.logger(`GAME GATE captures: ${__dirname}/captures/GATE/${1000/GATE_FREQUENCY}FPS/${uniq}`)
    for (const capture of capturesGate) {
        await saveCapture(capture.screen, `./captures/GATE/${1000/GATE_FREQUENCY}FPS/${uniq}`, 'rec-');
    }

    if (capturesDistance.length) monitoring.logger(`GAME DISTANCE captures: ${__dirname}/captures/DISTANCE/${1000/GATE_FREQUENCY}FPS/${uniq}`)
    for (const capture of capturesDistance) {
        await saveCapture(capture.screen, `./captures/DISTANCE/${1000/GATE_FREQUENCY}FPS/${uniq}`, 'rec-');
    }
}

const sleep = require('util').promisify(setTimeout);

Terminal(config.terminal, monitoring)
    .on('start', (context, gate, distance, machine, controller, terminal) => {
        monitoring.logger('##### GAME START #####');
        console.log('start...')

        gate.start();
        distance.start(context.targets);
        machine.start();
    })
    .on('stop', async (context, gate, distance, machine, controller, terminal) => {
        monitoring.logger('##### GAME STOP #####');
        console.log('stop...')

        terminal.stop();

        gate.stop();
        distance.stop();
        machine.stop();
        terminal.stop();

        await saveCaptures();

        capturesGate.splice(0, capturesGate.length)
        capturesDistance.splice(0, capturesDistance.length)
    })
    .on('quit', async (context, gate, distance, machine, controller, terminal) => {
        monitoring.logger('##### QUIT #####');
        console.log('quit...')

        terminal.stop();

        gate.stop();
        distance.stop();
        terminal.quit()

        await saveCaptures();

        await sleep(2000);

        process.exit();
    })
    .on('reload', async (context, gate, distance, machine, controller, terminal) => {
        monitoring.logger('##### GAME RELOAD #####');
        console.log('reload...')

        gate.stop();
        distance.stop();
        machine.stop();

        await sleep(2000);

        await saveCaptures();

        controller.jump();
        
        await sleep(1000);
        
        controller.jump();

        await sleep(1000);
        
        context.targets.splice(0, context.targets.length);

        gate.start();
        distance.start(context.targets);
        machine.start();
    })
    .context((terminal) => {
        const context = { targets: [] };
        
        const controller = Controller();
        const gate = Gate(config.gate, monitoring);
        const distance = Distance(config.distance, monitoring);
        const machine = Machine(config.machine, controller, monitoring);

        return [
            context,
            gate
                .on('capture_match', (capture) => capturesGate.push(capture))
                .on('capture_terminate', (capture) => capturesGate.push(capture))
                .on('initialize', () => monitoring.logger('Gate -> initialize'))
                .on('terminate', (target) => context.targets.push(target) && monitoring.logger('Gate -> terminate')),

            distance
                .on('capture', (capture) => capturesDistance.push(capture))
                .on('initialize', (target) => {
                    monitoring.logger('Distance -> initialize');
                    monitoring.logger(JSON.stringify(target))

                    machine.initialize(target);
                })
                .on('distance', (distance) => {
                    // monitoring.distance('Distance -> ' + distance);

                    machine.play({ distance });
                })
                .on('scored', () => {
                    monitoring.logger('Distance -> ~scored');
                    console.log('SCORED')
                    machine.score();
                })
                .on('timeout', () => {
                    monitoring.logger('Distance -> timeout');

                    terminal.emit('reload', context, gate, distance, machine, controller, terminal);
                }),
            machine,
            controller
        ]
    })
// ######################        /Execution          ######################
