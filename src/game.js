require('dotenv').config();

// ######################        Globals          ######################


const GATE_SIZE = { width: Number(process.env.GATE_SIZE_WIDTH), height: Number(process.env.GATE_SIZE_HEIGHT) };
const GATE_POSITION = { x: Number(process.env.GATE_POSITION_X), y: Number(process.env.GATE_POSITION_Y) };

const DISTANCE_POSITION = { x: Number(process.env.DISTANCE_POSITION_X), y: Number(process.env.DISTANCE_POSITION_Y) };
const DISTANCE_SIZE = { width: Number(process.env.DISTANCE_SIZE_WIDTH), height: Number(process.env.DISTANCE_SIZE_HEIGHT) };

const MACHINE_LOCATION = __dirname + '/../machine';

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
            if (!context.state.start) return;

            if (!context.jumpToggle) {
                // console.log('JUMP');
                robotjs.keyToggle('down', 'up');
                robotjs.keyTap('up');

                context.jumpToggle = setTimeout(() => {
                    context.jumpToggle = null;
                }, 100)
            }

            context.crouchToggle = clearTimeout(context.crouchToggle);
        },
        crouch: () => {
            if (!context.state.start) return;

            context.jumpToggle = clearTimeout(context.jumpToggle);
            
            if (!context.crouchToggle) {
                // console.log('CROUCH');
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
    stopwatch: { gate: 'stopwatch.gate', distance: 'stopwatch.distance'},
    logger: 'logger',
    distanceMetter: 'distance-metter',
    stats: 'stats',
    top10: 'top10'
};
const Monitoring = (address, port) => {
    
    const monitoringClient = ((client, address, port) => (data) => {
        const buffer = Buffer.from(JSON.stringify(data));

        client.send(buffer, port, address)
    })(udp.createSocket('udp4'), address, port);

    const self = () => Object.assign({}, {
        logger: ((client) => (content) => {
            client({ type: MONITORING_TYPES.logger, data:content });
        })(monitoringClient),
        stopwatch: ((client) => async (config, func) => {
            const start = process.hrtime.bigint();
    
            const resolve = await func();

            const end = process.hrtime.bigint();
            
            if (resolve) { resolve() }

            if (config.active) { client({ type: config.type, data: converters.milliseconds(Number(end - start)) }) }

        })(monitoringClient),
        distanceMetter: ((client) => (distance,  config) => {
            if (config.active) { client({ type: MONITORING_TYPES.distanceMetter, data:distance }) }
        })(monitoringClient),
        // { current: string, lastScore: number, running: string, generations: number }
        stats: ((client) => (data) => {
            client({ type: MONITORING_TYPES.stats, data })
        })(monitoringClient),
        // [["SCORE", "NETWORK_ID", "DATE"], ...]
        top10: ((client) => (data) => {
            client({ type: MONITORING_TYPES.top10, data })
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
            width: 0,
            locked: false
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
        
        const duration = context.state.activate.off - context.state.activate.on;
        const { width, height, origin } = captureDetails();
        
        return ({ origin, height, width, speed: width/duration });
    }

    function scannerRectangle(capture, size) {
        const matches = { left: null, right: null, top: null, bottom: null};

        // capture width
        for (let xLeft = 0; xLeft < size.width; xLeft++) {
            const xRight = size.width - xLeft - 1;
            for (let y = 0; y < size.height; y++) {
                const [left, right] = [
                    matches.left ? null : config.tracker.colors.includes(capture.colorAt(xLeft, y)), 
                    matches.right ? null : config.tracker.colors.includes(capture.colorAt(xRight, y))
                ];
            
                if (left) { matches.left = xLeft }

                if (right) { matches.right = xRight }

                if (null !== matches.left && null !== matches.right) { break }
            }

            if (null !== matches.left && null !== matches.right) { break }
        }

        // capture height
        for (let yTop = 0; yTop < size.height; yTop++) {
            const yBottom = size.height - yTop  - 1;
            for (let x = 0; x < size.width; x++) {
                const [top, bottom] = [
                    matches.top ? null : config.tracker.colors.includes(capture.colorAt(x, yTop)), 
                    matches.bottom ? null : config.tracker.colors.includes(capture.colorAt(x, yBottom))
                ];
            
                if (top) { matches.top = yTop }

                if (bottom) { matches.bottom = yBottom }

                if (null !== matches.top && null !== matches.bottom) { break }
            }

            if (null !== matches.top && null !== matches.bottom) { break }
        }

        return matches;
    }

    function scannerSquare(capture, size) {
        const matches = { left: null, right: null, top: null, bottom: null};

        // capture width
        for (let x = 0; x < size; x++) {
            const xx = size - x - 1;
            for (let y = 0; y < size; y++) {
                const [left, right, top, bottom] = [
                    matches.left ? null : config.tracker.colors.includes(capture.colorAt(x, y)), 
                    matches.right ? null : config.tracker.colors.includes(capture.colorAt(xx, y)),
                    matches.top ? null : config.tracker.colors.includes(capture.colorAt(y, x)), 
                    matches.bottom ? null : config.tracker.colors.includes(capture.colorAt(y, xx))
                ];
            
                if (left) { matches.left = x }

                if (right) { matches.right = xx }

                if (top) { matches.top = x }

                if (bottom) { matches.bottom = xx }

                if (null !== matches.left && null !== matches.right && null !== matches.top && null !== matches.bottom) { break }
            }

            if (null !== matches.left && null !== matches.right && null !== matches.top && null !== matches.bottom) { break }
        }

        return matches;
    }
    
    function captureDetails() {
        const maxWidth = 110;

        const x = config.position.x - maxWidth;
        const y = config.position.y;

        const capture = Capture(x, y, maxWidth, config.size.height);

        context.emitter.emit('capture_terminate', capture);

        const matches = config.scanner.size.height / config.scanner.size.width === 1 ? scannerSquare(capture, config.scanner.size.height) : scannerRectangle(capture, config.scanner.size);

        if ((!matches.top || !matches.bottom || !matches.left || !matches.right)) {
            monitoring.logger(`{red-fg}[GATE] -> [WARNING] missing target ....{/red-fg}`);
            console.log('[WARNING] missing target');
            throw new Error('Frame missing')
        }
        
        return { width: matches.right - matches.left, height: matches.bottom - matches.top, origin: config.size.height - matches.bottom - 1 };
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
        try {
            context.emitter.emit('terminate', computeState());
        } catch (e) {
            context.emitter.emit('reload');
        }
        clearContext();
    }
    const self = () => Object.assign({}, {
        'start': _start,
        'stop': _stop,
        'on': _on
    });
    
    function _start() {
        monitoring.logger(`[GATE] -> start`);
        context.interval = setInterval(async () => {
            if (context.state.locked) return;

            context.state.locked = true;
            await monitoring.stopwatch(config.monitoring.stopwatch, () => {
                const capture = Capture(config.position.x, config.position.y, config.size.width, config.size.height);
                const heightCompressed = (config.size.height - 1) / config.compressor;
                const widthCompressed = (config.size.width - 1) / config.compressor;
                const trackers = 2;
                
                let localMatch = false;
                for (let x = 0; x/config.compressor < widthCompressed; x++) {                                         
                    for (let y = 0; y/config.compressor < heightCompressed/trackers; y++) {                       

                        MoveMouse(true)(capture.converters.absolute.x(x), capture.converters.absolute.y(y));
                        MoveMouse(true)(capture.converters.absolute.x(x), capture.converters.absolute.y((config.size.height - 1) - y));

                        const [top, bottom] = [
                            config.tracker.colors.includes(capture.colorAt(x, y)), 
                            config.tracker.colors.includes(capture.colorAt(x, (config.size.height - 1) - y))
                        ];

                        if (top || bottom) { localMatch = true; break; }
                    }
                    if (localMatch) { break }
                }

                
                if (localMatch) context.emitter.emit('capture_match', capture);
                
                if (!context.state.match && localMatch) { return () => initialize() }
                
                if (context.state.match && !localMatch) { return () => terminate() }
            });
            context.state.locked = false;
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
                    MoveMouse(!!process.env.MOUSE_IGNORE_DISTANCE)(capture.converters.absolute.x(x), capture.converters.absolute.y(y));

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
            monitoring.stopwatch(config.monitoring.stopwatch, () => {
                if (!context.state.current && (!context.state.targets.length)) return;
                
                if (!context.state.current) {
                    context.state.current = context.state.targets.shift();
                    // console.log('INIT');
                    monitoring.logger(`[DISTANCE] -> initialize`);
                    
                    initTimeout();
                    return () => context.emitter.emit('initialize', context.state.current);
                }
                
                // Rustine - (config.size.height * 4
                const capture = Capture(config.position.x, config.position.y - (context.state.current.height / 2 + context.state.current.origin) - (config.size.height * 4), config.size.width, config.size.height);
                
                context.emitter.emit('capture', capture);

                context.state.distance = parseCapture(capture);
                
                monitoring.distanceMetter(context.state.distance, config.monitoring.distanceMetter);
                
                if (!context.state.passthrough && 40 > context.state.distance) {
                    context.state.passthrough = true ;
                    
                    return () => context.emitter.emit('distance', context.state.distance);
                } else if (context.state.passthrough && context.state.distance > 50) {
                    context.state.passthrough = false;
                    context.state.current = null;
                                        
                    monitoring.logger('[DISTANCE] -> scored');
                    
                    return () => context.emitter.emit('scored');
                } else if (!context.state.passthrough) {
                    if (context.state.distance > 260) return;

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

                const filename = fs.readdirSync(location).filter(e => e.match('.network')).slice(0, 1)[0];
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
            },
            stats: () => {
                const location = networks.process.location;

                const genomes = fs.readdirSync(location).filter(e => e.match('.network'));

                return {
                    running: 1 + config.network.generations-genomes.length,
                    current: genomes.slice(0, 1)[0],
                }
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
            },
            stats: () => {
                const location = networks.legacy.location;
                const score = (filename) => Number(filename.match(/[\d]{15}/).shift());

                const genomes = fs.readdirSync(location)
                    .filter(e => e.match('.network'))
                    .sort((a, b) =>  score(b) - score(a));

                return {
                    iterations: genomes.length / 2,
                    top10: genomes.slice(0, 10).map(e => [score(e), e.replace(/^[\d]{1,}-/, '', ), fs.statSync(`${location}/${e}`).mtime])
                }
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

    function monitore() {
        const processStats = networks.process.stats();
        const legacyStats =  networks.legacy.stats();

        monitoring.stats({ 
            current: processStats.current, 
            lastScore: context.state.score, 
            running: `${processStats.running}/${config.network.generations}`, 
            iterations: legacyStats.iterations
        });
        monitoring.top10(legacyStats.top10);
    }

    const self = () => Object.assign({}, {
        'start': _start,
        'stop': _stop,
        'initialize': _initialize,
        'play': _play,
        'scored': _scored
    });

    function _start() {
        monitoring.logger(`[MACHINE] -> start`);
        controller.start();

        if (networks.process.isEmpty()) { networks.process.initialize() }

        monitore()

        const data = networks.process.pick();

        context.network = data.network;
        context.location = data.location;
        context.state.on = Date.now();
    }

    function _stop() {
        context.state.off = Date.now();
        // context.state.score = Math.trunc(Math.max(0, (context.state.off - context.state.on - 5100) / 1.38));

        monitoring.logger(`[MACHINE] -> stop (score: ${context.state.score})`);

        controller.stop();


        networks.processed.store(context.location, context.network, context.state.score);

        if (networks.process.isEmpty()) {
            monitoring.logger('[MACHINE] -> meddle networks');
            networks.processed.meddle();    
        }

        monitore()

        clearContext();
    }

    function _initialize(rawInputs) {
        monitoring.logger(`[MACHINE] -> initialize`);

        computeInputs(Object.assign({}, rawInputs, { distance: null }));

        monitoring.logger(`[MACHINE] -> inputs {blue-fg}${JSON.stringify(context.state.inputs)}{/blue-fg}`);
    }

    function _scored() {
        context.state.score++;
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
    gate: { 
        stopwatch: { 
            type: MONITORING_TYPES.stopwatch.gate,
            active: !!Number(process.env.GATE_STOPWATCH),
            max: converters.nanoseconds(Number(process.env.GATE_STOPWATCH_MAX)),
            threshold: converters.nanoseconds(Number(process.env.GATE_FREQUENCY) * 0.7)
        }
    },
    distance: {
        stopwatch: {
            type: MONITORING_TYPES.stopwatch.distance,
            active: !!Number(process.env.DISTANCE_STOPWATCH),
            max: converters.nanoseconds(Number(process.env.DISTANCE_STOPWATCH_MAX)),
            threshold: converters.nanoseconds(Number(process.env.DISTANCE_FREQUENCY) * 0.7)
        },
        distanceMetter: {
            active: !!Number(process.env.DISTANCE_METTER),
        }
    },
    terminal: {},
    machine: {}
}

// Config
const config = {
    gate: {
        frequency: Number(process.env.GATE_FREQUENCY),
        compressor: Number(process.env.GATE_COMPRESSOR),
        position: GATE_POSITION,
        size: GATE_SIZE,
        tracker: { colors: process.env.TRACKING_COLORS.split(', ') },
        monitoring: configMonitoring.gate,
        scanner: {
            size: {
                width: Number(process.env.GATE_SCANNER_SIZE_WIDTH),
                height: Number(process.env.GATE_SCANNER_SIZE_HEIGHT),
            }
        }
    },
    distance: { 
        frequency: Number(process.env.DISTANCE_FREQUENCY),
        compressor: Number(process.env.DISTANCE_COMPRESSOR),
        timeout: Number(process.env.DISTANCE_TIMEOUT),
        position: DISTANCE_POSITION, size: DISTANCE_SIZE,
        tracker: { colors: process.env.TRACKING_COLORS.split(', ') },
        monitoring: configMonitoring.distance },
    terminal: { monitoring: configMonitoring.terminal },
    machine: { 
        location: MACHINE_LOCATION,
        network: { 
            generations: Number(process.env.MACHINE_NETWORK_GENERATIONS),
            input: Number(process.env.MACHINE_NETWORK_INPUT),
            layer: Number(process.env.MACHINE_NETWORK_LAYER),
            output: Number(process.env.MACHINE_NETWORK_OUTPUT) },
            inputs: { max: { width: Number(process.env.MACHINE_MAX_WIDTH),
                height: Number(process.env.MACHINE_MAX_HEIGHT),
                origin: Number(process.env.DISTANCE_MAX_ORIGIN),
                distance: Number(process.env.MACHINE_MAX_DISTANCE),
                speed: Number(process.env.MACHINE_MAX_SPEED)
            }
        },
        monitoring: configMonitoring.machine
    }
}

// ######################        /Config          ######################

// ######################        Execution          ######################
const monitoring = Monitoring(process.env.MONITORING_SERVER_ADDRESS, Number(process.env.MONITORING_SERVER_PORT));

// Useful for debug
async function saveCaptures(captures) {
    const capturesGate = captures.gate;
    const capturesDistance = captures.distance;

    const uniq = uuid.v4();

    if (capturesGate.length) monitoring.logger(`{white-fg}[CAPTURE][GATE]: start saving{/white-fg}`)
    for (const capture of capturesGate) {
        await saveCapture(capture.screen, `./captures/GATE/${1000/Number(process.env.GATE_FREQUENCY)}FPS/${uniq}`, 'rec-');
    }
    if (capturesGate.length) monitoring.logger(`{green-fg}[CAPTURE][GATE]: success save ${__dirname}/captures/gate/${1000/Number(process.env.GATE_FREQUENCY)}FPS/${uniq}{/green-fg}`)

    if (capturesDistance.length) monitoring.logger(`{white-fg}[CAPTURE][DISTANCE]: start saving{/white-fg}`)
    for (const capture of capturesDistance) {
        await saveCapture(capture.screen, `./captures/DISTANCE/${1000/Number(process.env.DISTANCE_FREQUENCY)}FPS/${uniq}`, 'rec-');
    }
    if (capturesDistance.length) monitoring.logger(`{green-fg}[CAPTURE][DISTANCE]: success save ${__dirname}/captures/distance/${1000/Number(process.env.DISTANCE_FREQUENCY)}FPS/${uniq}{/green-fg}`)
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

    await sleep(2000);
    
    robotjs.moveMouse(323, 251);
    
    await sleep(100);

    robotjs.mouseClick('left');
    robotjs.keyTap('up');
    
    monitoring.logger('{green-fg}##### GAME START #####{/green-fg}');
    
    machine
        .start();

    gate
        .on('capture_match', (capture) => !(Number(process.env.GATE_CAPTURE)) ? null : context.captures.gate.push(capture))
        .on('capture_terminate', (capture) => !(Number(process.env.GATE_CAPTURE)) ? null : context.captures.gate.push(capture))
        .on('terminate', (target) => context.targets.push(target))
        .on('reload', async () => {
            monitoring.logger('{yellow-fg}##### GAME FRAME FREEZED | RELOADING #####{/yellow-fg}');
            monitoring.logger('');

            await require('util').promisify(setTimeout)(500);

            process.exit(1);
        })
        .start();
    
    distance
        .on('capture', (capture) => !(Number(process.env.DISTANCE_CAPTURE)) ? null : context.captures.distance.push(capture))
        .on('initialize', (target) => machine.initialize(target) )
        .on('distance', (distance) => machine.play({ distance }) )
        .on('timeout', async () => {
            gate.stop();
            distance.stop();
            machine.stop();
    
            
            monitoring.logger('{red-fg}##### GAME OVER #####{/red-fg}');
            monitoring.logger('');

            await saveCaptures(context.captures);
    
            await require('util').promisify(setTimeout)(3000);
    
            process.exit(1);
        })
        .on('scored', () => {
            machine.scored();
        })
        .start(context.targets);
})()

// ######################        /Execution          ######################
