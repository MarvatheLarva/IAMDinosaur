// ######################        Globals          ######################
const MOUSE_IGNORE_GATE = true;
const MOUSE_IGNORE_DISTANCE = true;

const MONITORING_SERVER_ADDRESS = '0.0.0.0';
const MONITORING_SERVER_PORT = 2222;

const TRACKING_COLORS = ['acacac', '535353'];

const GATE_STOPWATCH_MUTE = false;
const GATE_FREQUENCY = 16; // ms
const GATE_COMPRESSOR = 2;

const GATE_SIZE = { width: 10, height: 110 };
const GATE_POSITION = { x: 480, y: 164 };

const DISTANCE_STOPWATCH_MUTE = false;
const DISTANCE_FREQUENCY = 10; // ms
const DISTANCE_COMPRESSOR = 2;
const DISTANCE_TIMEOUT = 2000;

const DISTANCE_POSITION = { x: 90, y: 278 };
const DISTANCE_SIZE = { width: 270, height: 2 };

const MACHINE_LOCATION = __dirname + '/../machine';

const MACHINE_NETWORK_GENERATIONS = 12;
const MACHINE_NETWORK_INPUT = 5;
const MACHINE_NETWORK_LAYER = 4;
const MACHINE_NETWORK_OUTPUT = 1;

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

const Controller = (monitoring) => {
    const context = {
        state: {
            start: false
        },
        jumpToggle: null,
        crouchToggle: null,
    };

    return Object.assign({}, {
        jump: () => {
            if (!context.jumpToggle) {
                console.log('JUMP');
                robotjs.keyToggle('down', 'up');
                robotjs.keyTap('up');

                context.jumpToggle = setTimeout(() => {
                    context.jumpToggle = null;
                }, 100)
            }

            context.crouchToggle = clearTimeout(context.crouchToggle);
        },
        normal: () => {
            context.crouchToggle = robotjs.keyToggle('down', 'up');
            robotjs.keyToggle('up', 'up')
        },
        crouch: () => {
            context.jumpToggle = clearTimeout(context.jumpToggle);
            
            if (!context.crouchToggle) {
                console.log('CROUCH');
                robotjs.keyToggle('down', 'down');
            }

            context.crouchToggle = clearTimeout(context.crouchToggle);
            context.crouchToggle = setTimeout(() => {
                context.crouchToggle = clearTimeout();
                robotjs.keyToggle('down', 'up');
            }, 500)
        },
        start: () => {
            context.state.start = true;
        },
        stop: () => {
            context.state.start = false;
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

    const self = () => Object.assign({}, {
        logger: ((client) => (content, channel = 'main') => {
            client({ type: MONITORING_TYPES.logger, name: channel, content })
        })(monitoringClient),
        stopwatch: ((client) => async (name, config, func) => {
            const start = process.hrtime.bigint();
    
            const resolve = await func();

            const end = process.hrtime.bigint();

            const measure = Number(end - start); // nano seconds

            if (!config.mute)
                client({ type: MONITORING_TYPES.stopwatch, name, measure, max: config.max, threshold: config.threshold });
            
            if (measure < config.max && resolve) {
                resolve()
            } else if (measure > config.max) { self().logger(`****** [WARNING] SKIP FRAME ${measure}/${config.max}`) }
        })(monitoringClient)
    })

    return self();
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
        const x = config.position.x - 70;
        const y = config.position.y + config.size.height - origin - (height / 2);
        const capture = Capture(x, y, 70, 1);

        context.emitter.emit('capture_terminate', capture);
        
        let width = 0;
        for (let i = 69; i >= 0; i--) {            
            if(config.tracker.colors.includes(capture.colorAt(i, 0))) {
                width++;
            }
        }
        
        return width;
    }
    
    function initialize() {
        context.state.match = true;
        context.state.activate.on = Date.now();
        
        monitoring.logger(`[GATE] -> initialize`);
        context.emitter.emit('initialize');
    }
    
    function terminate() {
        context.state.activate.off = Date.now();
        
        monitoring.logger(`[GATE] -> terminate`);
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
                for (let x = 0; x/config.compressor < widthCompressed; x++) {                       
                    let topMatch = false;
                    let bottomMatch = false;
                    
                    for (let y = 0; y/config.compressor < heightCompressed/trackers; y++) {
                        MoveMouse(MOUSE_IGNORE_GATE)(capture.converters.absolute.x(x), capture.converters.absolute.y(y));
                        MoveMouse(MOUSE_IGNORE_GATE)(capture.converters.absolute.x(x), capture.converters.absolute.y((config.size.height - 1) - y));
                        
                        const [top, bottom] = [
                            topMatch ? null : config.tracker.colors.includes(capture.colorAt(x, y)), 
                            bottomMatch ? null : config.tracker.colors.includes(capture.colorAt(x, (config.size.height - 1) - y))
                        ];

                        if (top || bottom) {
                            if (top && !topMatch) topMatch = true;

                            if (bottom && !bottomMatch) bottomMatch = true;

                            localMatch = true;

                            context.state.positions.push(top ? y : config.size.height - y);
                            context.state.width++;                            
                        }

                        if (topMatch && bottomMatch) { break }
                    }
                }

                if (localMatch) context.emitter.emit('capture_match', capture);

                if (!context.state.match && localMatch) { return () => initialize() }
                
                if (context.state.match && !localMatch) { return () => terminate() }
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
        for (let yCompressed = 0; yCompressed < config.size.height / config.compressor; yCompressed++) {
            const y = yCompressed * config.compressor;
            for (let xCompressed = 0; xCompressed < config.size.width / config.compressor; xCompressed++) {
                const x = xCompressed * config.compressor;
            
                if (config.tracker.colors.includes(capture.colorAt(x, 0))) {
                    MoveMouse(MOUSE_IGNORE_DISTANCE)(capture.converters.absolute.x(x), capture.converters.absolute.y(y));

                    return x;
                }
            }
        }

        return config.size.width;
    }

    function initTimeout() {
        clearTimeout(context.timeout);
        context.timeout = setTimeout(() => {
            monitoring.logger(`[DISTANCE] -> timeout`);

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
                    console.log('INIT');
                    monitoring.logger(`[DISTANCE] -> initialize`);
                    
                    initTimeout();
                    return () => context.emitter.emit('initialize', context.state.current);
                }

                // Rustine - (config.size.height * 4)
                const capture = Capture(config.position.x, config.position.y - (context.state.current.height / 2 + context.state.current.origin) - (config.size.height * 4), config.size.width, config.size.height);
                
                context.emitter.emit('capture', capture);

                context.state.distance = parseCapture(capture);
                
                console.log(context.state.distance);
                
                if (!context.state.passthrough && 40 > context.state.distance) {
                    context.state.passthrough = true ;
                    console.log('PASSTHROUGH');
                    
                    return () => context.emitter.emit('distance', context.state.distance);
                } else if (context.state.passthrough && context.state.distance > 50) {
                    context.state.passthrough = false;
                    context.state.current = null;
                    
                    console.log('SCORED');
                    
                    monitoring.logger('[DISTANCE] -> scored');
                    
                    return () => context.emitter.emit('scored');
                } else if (!context.state.passthrough) {
                    if (context.state.distance > 260) return;
                    console.log('.');
                    return () => context.emitter.emit('distance', context.state.distance);
                }
            });
        }, config.frequency);

        return self();
    }

    function _stop() {
        
        clearTimeout(context.timeout);
        clearInterval(context.interval);
        clearContext();

        monitoring.logger(`[DISTANCE] -> stop`);

        return self();
    }

    function _on(e, func) {
        monitoring.logger(`[DISTANCE] -> register on(${e})`);
        context.emitter.on(e, func);

        return self();
    }

    return self();
};

// Machine
const { Architect, Network } = require('synaptic');
const fs = require('fs');
const cloneDeep = require('lodash/cloneDeep');

const Machine = (config, controller, monitoring) => {
    const genetics = {
        crossOver: (netA, netB) => {
            monitoring.logger(`[MACHINE][genetics] -> crossOver`);

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
            monitoring.logger(`[MACHINE][genetics] -> mutate`);

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
                monitoring.logger(`[MACHINE][networks] -> process initialize`);

                for (let i = 0; i < config.network.generations; i++) {
                    const network = new Architect.Perceptron(config.network.input, config.network.layer, config.network.output);
    
                    // write network into file
                    networks.process.store(network);
                }
            },
            pick: () => {
                monitoring.logger(`[MACHINE][networks] -> process pick`);

                const location = networks.process.location;

                const filename = fs.readdirSync(location).filter(e => e.match('.network')).slice(0, 1);
                const path = `${location}/${filename}`;

                return { location: path, network: Network.fromJSON(JSON.parse(fs.readFileSync(path))) };
            },
            store: (network) => {
                monitoring.logger(`[MACHINE][networks] -> process store`);

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
                monitoring.logger(`[MACHINE][networks] -> processed meedle`);

                // pick & archive LEGACY 2 bests processed networks from PROCESSED
                const location = networks.processed.location;
                const score = (filename) => Number(filename.match(/[\d]{15}/).shift());

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
                monitoring.logger(`[MACHINE][networks] -> processed cleans`);

                const location = networks.processed.location;

                fs.readdirSync(location)
                    .filter(e => e.match('.network'))
                    .map(e => fs.unlinkSync(`${location}/${e}`))
            },
            store: (processLocation, network, score) => {
                monitoring.logger(`[MACHINE][networks] -> processed store`);

                const location = networks.processed.location;
                const scoreString = String(score);
                const placeholdder = '000000000000000';
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
                monitoring.logger(`[MACHINE][networks] -> legacy store`);

                const location = networks.legacy.location;
                const scoreString = String(score);
                const placeholdder = '000000000000000';

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
            on: null,
            off: null,
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
        context.state.on = null;
        context.state.off = null;
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
    });

    function _start() {
        monitoring.logger(`[MACHINE] -> start`);

        if (networks.process.isEmpty()) { networks.process.initialize() }

        const data = networks.process.pick();

        context.network = data.network;
        context.location = data.location;
        context.state.on = Date.now();
    }

    function _stop() {
        context.state.off = Date.now();
        const score = Math.trunc(Math.max(0, (context.state.off - context.state.on - 5100) / 1.38));

        monitoring.logger(`[MACHINE] -> stop (score: ${score})`);

        console.log(score);
        networks.processed.store(context.location, context.network, score);

        if (networks.process.isEmpty()) {
            monitoring.logger('[MACHINE] -> meddle networks')
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

        if (output > 0.55) controller.jump();
        if (output < 0.45) controller.crouch();
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

// Useful for debug
async function saveCaptures(captures) {
    const capturesGate = captures.gate;
    const capturesDistance = captures.distance;

    const uniq = uuid.v4();

    if (capturesGate.length) monitoring.logger(`##### GATE captures: ${__dirname}/captures/gate/${1000/GATE_FREQUENCY}FPS/${uniq}`)
    for (const capture of capturesGate) {
        await saveCapture(capture.screen, `./captures/GATE/${1000/GATE_FREQUENCY}FPS/${uniq}`, 'rec-');
    }

    if (capturesDistance.length) monitoring.logger(`##### DISTANCE captures: ${__dirname}/captures/distance/${1000/DISTANCE_FREQUENCY}FPS/${uniq}`)
    for (const capture of capturesDistance) {
        await saveCapture(capture.screen, `./captures/DISTANCE/${1000/DISTANCE_FREQUENCY}FPS/${uniq}`, 'rec-');
    }
}

// ######################        Execution          ######################

(async () => {
    const sleep = require('util').promisify(setTimeout);

    const context = { 
        targets: [],
        captures: {
            gate: [],
            distance: []
        }
    };
            
    const controller = Controller(monitoring);
    const gate = Gate(config.gate, monitoring);
    const distance = Distance(config.distance, monitoring);
    const machine = Machine(config.machine, controller, monitoring);
    
    robotjs.moveMouse(323, 251);
    
    await sleep(100);

    robotjs.mouseClick('left');
    robotjs.keyTap('up');
    
    monitoring.logger('##### GAME START #####');
    
    machine
        .start();

    gate
        .on('capture_match', (capture) => context.captures.gate.push(capture))
        .on('capture_terminate', (capture) => context.captures.gate.push(capture))
        .on('terminate', (target) => context.targets.push(target) )
        .start();
    
    distance
        .on('capture', (capture) => context.captures.distance.push(capture))
        .on('initialize', (target) => machine.initialize(target) )
        .on('distance', (distance) => machine.play({ distance }) )
        .on('timeout', async () => {
            gate.stop();
            distance.stop();
            machine.stop();
    
            await saveCaptures(context.captures);
    
            monitoring.logger('##### GAME OVER #####');
            monitoring.logger('');
    
            await sleep(2000);
    
            process.exit(1);
        })
        .start(context.targets);
    
})()

// ######################        /Execution          ######################
