const { EventEmitter } = require('events');
const sleep = require('util').promisify(setTimeout);
const uuid = require('uuid');

// ######################        Globals          ######################
const MOUSE_IGNORE_GATE = true;
const MOUSE_IGNORE_DISTANCE = false;

const MONITORING_SERVER_ADDRESS = '0.0.0.0';
const MONITORING_SERVER_PORT = 2222;

const TRACKING_COLORS = ['acacac', '535353'];

const GATE_FREQUENCY = 10; // ms
const GATE_COMPRESSOR = 2;

const GATE_SIZE = { width: 10, height: 110 };
const GATE_POSITION = { x: 480, y: 164 };

const DISTANCE_FREQUENCY = 10; // ms
const DISTANCE_COMPRESSOR = 2;
const DISTANCE_TIMEOUT = 15000;

const DISTANCE_POSITION = { x: 90, y: 278 };
const DISTANCE_SIZE = { width: 270, height: 1 };

const MACHINE_MIN_WIDTH = 0;
const MACHINE_MIN_HEIGHT = 0;
const MACHINE_MIN_DISTANCE = 0;
const MACHINE_MIN_SPEED = 0;

const MACHINE_MAX_WIDTH = 50;
const MACHINE_MAX_HEIGHT = 50;
const MACHINE_MAX_DISTANCE = DISTANCE_SIZE.width;
const MACHINE_MAX_SPEED = 0.5;
const DISTANCE_MAX_ORIGIN = DISTANCE_SIZE.height;
const DISTANCE_MAX_DURATION = 1000;

// ######################        /Globals          ######################

// ######################        Utils          ######################

const robotjs = require('robotjs');
robotjs.setMouseDelay(0);
robotjs.setKeyboardDelay(0);

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
const MONITORING_TYPES = {
    stopwatch: 'stopwatch',
    logger: 'logger'
};
const udp = require('dgram');
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
        context.state.positions.sort(function(a, b){return b-a});
        
        const origin = config.size.height - context.state.positions.shift(); 
        const height = config.size.height - context.state.positions.pop() - origin;
        const duration = context.state.activate.off - context.state.activate.on;
        const width = captureWidth(origin, height);
        
        return ({ origin, height, duration, width, speed: width/duration });
    }
    
    function captureWidth(origin, height) {
        const x = config.position.x - 100;
        const y = config.position.y + config.size.height - origin - (height / 2);
        const capture = Capture(x, y, 100, 1);

        context.emitter.emit('capture_terminate', capture);
        
        let tolerance = 20;
        let width = 0;
        for (let i = 99 / config.compressor; i >= 0; i--) {
            if (tolerance === 0) break;
            
            if(config.tracker.colors.includes(capture.colorAt(i * config.compressor, 0))) {
                width++;
            } else if (width > 0) {
                tolerance--;
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

                if (!context.state.passthrough && 10 > context.state.distance) {
                    context.state.passthrough = true ;
                } else if (context.state.passthrough && context.state.distance > 10) {
                    context.state.passthrough = false;
                    context.state.current = null;
                    
                    context.emitter.emit('scored');
                } else if (!context.state.passthrough && context.state.distance > 10) {
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
            'Press r': 're-Start learning',
            'Press p': 'Start game with best known genome',
            'Press q': 'Stop game', 
        }, null, 2));
    }

    const self = () => Object.assign({}, {
        'start': _start,
        'stop': _stop,
        'on': _on,
        'emit': _emit
    });

    function _start(func) {
        monitoring.logger('[TERMINAL] -> start');
        displayHelp();

        readline.emitKeypressEvents(process.stdin);
        process.stdin.setRawMode(true);

        context.state = func(self());

        process.stdin.on('keypress', ((args) => (str, key) => { 
            if (str === '?' || key.name === 'h') displayHelp()
            if (key.name === 'q') context.emitter.emit('stop', ...args, self())
            if (key.name === 's') context.emitter.emit('start', ...args, self())
            if (key.name === 'r') context.emitter.emit('reload', ...args, self())
        })(context.state))
    }

    function _stop() {
        monitoring.logger('[TERMINAL] -> stop');

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
const Machine = (config, monitoring) => {
    const context = {
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
    }

    function _stop() {
        monitoring.logger(`[MACHINE] -> stop`);
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
        // const output = network.activate(Object.values(context.state.inputs));
        // monitoring.play(output);
    }

    function _score() {
        monitoring.logger(`[MACHINE] -> score`);
    }
    

    return self();
}

// ######################        /Domain          ######################

// ######################        Config          ######################

// Config Sensors Monitoring
const configMonitoring = {
    gate: { stopwatch: { max: converters.nanoseconds(GATE_FREQUENCY), threshold: converters.nanoseconds(GATE_FREQUENCY * 0.7) } },
    distance: { stopwatch: { max: converters.nanoseconds(DISTANCE_FREQUENCY), threshold: converters.nanoseconds(DISTANCE_FREQUENCY * 0.7) } },
    terminal: {},
    machine: {}
}

// Config
const config = {
    gate: { frequency: GATE_FREQUENCY, compressor: GATE_COMPRESSOR, position: GATE_POSITION, size: GATE_SIZE, tracker: { colors: TRACKING_COLORS }, monitoring: configMonitoring.gate },
    distance: { frequency: DISTANCE_FREQUENCY, compressor: DISTANCE_COMPRESSOR, timeout: DISTANCE_TIMEOUT, position: DISTANCE_POSITION, size: DISTANCE_SIZE, tracker: { colors: TRACKING_COLORS }, monitoring: configMonitoring.distance },
    terminal: { monitoring: configMonitoring.terminal },
    machine: { inputs: { min: { width: MACHINE_MIN_WIDTH, height: MACHINE_MIN_HEIGHT, distance: MACHINE_MIN_DISTANCE, speed: MACHINE_MIN_SPEED }, max: { width: MACHINE_MAX_WIDTH, height: MACHINE_MAX_HEIGHT, origin: DISTANCE_MAX_ORIGIN, duration: DISTANCE_MAX_DURATION, distance: MACHINE_MAX_DISTANCE, speed: MACHINE_MAX_SPEED } }, monitoring: configMonitoring.machine }
}

// ######################        /Config          ######################

// ######################        Execution          ######################
const monitoring = Monitoring(MONITORING_SERVER_ADDRESS, MONITORING_SERVER_PORT);

const targets = [];
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

Terminal(config.terminal, monitoring)
    .on('start', (gate, distance, machine, terminal) => {
        monitoring.logger('##### GAME START #####');
        console.log('start...')

        gate.start();
        distance.start(targets);
        machine.start();
    })
    .on('stop', async (gate, distance, machine, terminal) => {
        monitoring.logger('##### GAME STOP #####');
        console.log('quit...')

        gate.stop();
        distance.stop();
        machine.stop();

        await saveCaptures();

        await sleep(2000);
        process.exit();
    })
    .on('reload', async (gate, distance, machine, terminal) => {
        monitoring.logger('##### GAME RELOAD #####');
        console.log('reload...')

        gate.stop();
        distance.stop();
        machine.stop();

        await sleep(1000);
        
        targets.splice(0, targets.length);

        gate.start();
        distance.start(targets);
        machine.start();
    })
    .start((terminal) => {
        const gate = Gate(config.gate, monitoring);
        const distance = Distance(config.distance, monitoring);
        const machine = Machine(config.machine, monitoring);

        return [
            gate
                .on('capture_match', (capture) => capturesGate.push(capture))
                .on('capture_terminate', (capture) => capturesGate.push(capture))
                .on('initialize', () => monitoring.logger('Gate -> initialize'))
                .on('terminate', (target) => targets.push(target) && monitoring.logger('Gate -> terminate')),

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
                    machine.score();
                })
                .on('timeout', () => {
                    monitoring.logger('Distance -> timeout');
                    terminal.emit('reload', gate, distance, machine, terminal);
                }),
            machine
        ]
    })
// ######################        /Execution          ######################
