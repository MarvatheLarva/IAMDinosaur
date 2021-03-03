require('dotenv').config();

// ######################        Globals          ######################

const GATE_SIZE = { width: Number(process.env.GATE_SIZE_WIDTH), height: Number(process.env.GATE_SIZE_HEIGHT) };
const GATE_POSITION = { x: Number(process.env.GATE_POSITION_X), y: Number(process.env.GATE_POSITION_Y) };

// ######################        /Globals          ######################

// ######################        Utils          ######################
const robotjs = require('robotjs');

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


const MoveMouse = (ignore) => (x, y) => {
    ignore ? null : robotjs.moveMouse(x, y);
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
        stopwatch: ((client) => async (name, config, func) => {
            const start = process.hrtime.bigint();
    
            const resolve = await func();

            const end = process.hrtime.bigint();

            const measure = Number(end - start); // nano seconds
            
            if (resolve) resolve()

            if (!config.mute)
                client({ type: config.type, data: converters.milliseconds(measure) });
            
            //if (measure < config.max && resolve) {
            //} else if (measure > config.max) { self().logger(`{red-fg}****** [WARNING][${config.type}] SKIP FRAME ${measure}/${config.max}{/red-fg}`) }
        })(monitoringClient),
        distanceMetter: ((client) => (distance) => {
            client({ type: MONITORING_TYPES.distanceMetter, data:distance })
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

async function saveCaptures(captures) {
    const capturesGate = captures.gate;
    const capturesDistance = captures.distance;

    const uniq = require('uuid').v4();

    if (capturesGate.length) monitoring.logger(`##### GATE captures: ${__dirname}/captures/gate/${1000/Number(process.env.GATE_FREQUENCY)}FPS/${uniq}`)
    for (const capture of capturesGate) {
        await saveCapture(capture.screen, `./captures/GATE/${1000/Number(process.env.GATE_FREQUENCY)}FPS/${uniq}`, 'rec-');
    }

    if (capturesDistance.length) monitoring.logger(`##### DISTANCE captures: ${__dirname}/captures/distance/${1000/Number(process.env.DISTANCE_FREQUENCY)}FPS/${uniq}`)
    for (const capture of capturesDistance) {
        await saveCapture(capture.screen, `./captures/DISTANCE/${1000/Number(process.env.DISTANCE_FREQUENCY)}FPS/${uniq}`, 'rec-');
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


// Sensors
const Gate2 = (config, monitoring) => {
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
    
    function captureDetails() {
        const maxWidth = 70;

        const x = config.position.x - maxWidth;
        const y = config.position.y;

        const capture = Capture(x, y, maxWidth, config.size.height);

        context.emitter.emit('capture_terminate', capture);

        const matches = { left: null, right: null, top: null, };
        // capture width
        for (let xLeft = 0; xLeft < maxWidth; xLeft++) {
            const xRight = maxWidth - xLeft - 1;
            for (let y = 0; y < config.size.height; y++) {
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
        for (let yTop = 0; yTop < config.size.height; yTop++) {
            const yBottom = config.size.height - yTop  - 1;
            for (let x = 0; x < maxWidth; x++) {
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
        context.interval = setInterval(async () => {
            if (context.state.locked) return;

            context.state.locked = true;
            await monitoring.stopwatch('Gate', config.monitoring.stopwatch, () => {
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


// ######################        /Domain          ######################

// ######################        Config          ######################

// Config Sensors Monitoring
const configMonitoring = {
    gate: { 
        stopwatch: { 
            type: MONITORING_TYPES.stopwatch.gate,
            mute: !!Number(process.env.GATE_STOPWATCH_MUTE),
            max: converters.nanoseconds(Number(process.env.GATE_FREQUENCY)),
            threshold: converters.nanoseconds(Number(process.env.GATE_FREQUENCY) * 0.7)
        }
    }
}

// Config
const config = {
    gate: {
        frequency: Number(process.env.GATE_FREQUENCY),
        compressor: Number(process.env.GATE_COMPRESSOR),
        position: GATE_POSITION,
        size: GATE_SIZE,
        tracker: { colors: process.env.TRACKING_COLORS.split(', ') },
        monitoring: configMonitoring.gate
    }
}

// ######################        /Config          ######################

// ######################        Execution          ######################
const monitoring = Monitoring(process.env.MONITORING_SERVER_ADDRESS, Number(process.env.MONITORING_SERVER_PORT));

// ######################        Execution          ######################

const context = { 
    targets: [],
    captures: {
        gate: [],
        distance: []
    }
};
(async () => {
            
    const gate = Gate2(config.gate, monitoring);

    gate
        .on('capture_match', (capture) => context.captures.gate.push(capture))
        .on('capture_terminate', (capture) => context.captures.gate.push(capture))
        .on('terminate', (target) => console.log(target) )
        .start();
    })()
    
    setTimeout(() => {
        console.log('AAAAAAAAAALALLLOOO');
        (async () => {
            await saveCaptures(context.captures);
            console.log('AAAAAAAAAALALLLOOO2');
        await require('util').promisify(setTimeout)(6000);
        process.exit();
        })() 
    }, 10000)
    // ######################        /Execution          ######################
