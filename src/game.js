require('dotenv').config();

const { Client, PROBE } = require('./monitoring');
const { Gate, Distance } = require('./sensor');
const { Machine } = require('./machine');
const { Controller } = require('./robot');
const { saveCaptures, converters } = require('./utils');

const sleep = require('util').promisify(setTimeout)

// ######################        Config          ######################

// Config Sensors Monitoring
const configMonitoring = {
    gate: { 
        stopwatch: { 
            probe: PROBE.stopwatch.gate,
            active: !!Number(process.env.GATE_STOPWATCH),
            max: converters.nanoseconds(Number(process.env.GATE_STOPWATCH_MAX)),
            threshold: converters.nanoseconds(Number(process.env.GATE_FREQUENCY) * 0.7)
        }
    },
    distance: {
        stopwatch: {
            probe: PROBE.stopwatch.distance,
            active: !!Number(process.env.DISTANCE_STOPWATCH),
            max: converters.nanoseconds(Number(process.env.DISTANCE_STOPWATCH_MAX)),
            threshold: converters.nanoseconds(Number(process.env.DISTANCE_FREQUENCY) * 0.7)
        },
        distanceMetter: {
            active: !!Number(process.env.DISTANCE_METTER),
        }
    }
}

// Config
const config = {
    monitoring: {
        address: process.env.MONITORING_SERVER_ADDRESS,
        port: Number(process.env.MONITORING_SERVER_PORT)
    },
    gate: {
        frequency: Number(process.env.GATE_FREQUENCY),
        compressor: Number(process.env.GATE_COMPRESSOR),
        position: { x: Number(process.env.GATE_POSITION_X), y: Number(process.env.GATE_POSITION_Y) },
        size: { width: Number(process.env.GATE_SIZE_WIDTH), height: Number(process.env.GATE_SIZE_HEIGHT) },
        tracker: { colors: process.env.TRACKING_COLORS.split(', ') },
        monitoring: configMonitoring.gate,
        scanner: {
            size: {
                width: Number(process.env.GATE_SCANNER_SIZE_WIDTH),
                height: Number(process.env.GATE_SCANNER_SIZE_HEIGHT),
            }
        },
        controller: { mouse: Number(process.env.GATE_MOUSE) }
    },
    distance: { 
        frequency: Number(process.env.DISTANCE_FREQUENCY),
        compressor: Number(process.env.DISTANCE_COMPRESSOR),
        timeout: Number(process.env.DISTANCE_TIMEOUT),
        position: { x: Number(process.env.DISTANCE_POSITION_X), y: Number(process.env.DISTANCE_POSITION_Y) },
        size: { width: Number(process.env.DISTANCE_SIZE_WIDTH), height: Number(process.env.DISTANCE_SIZE_HEIGHT) },
        tracker: { colors: process.env.TRACKING_COLORS.split(', ') },
        monitoring: configMonitoring.distance,
        controller: { mouse: Number(process.env.GATE_MOUSE) }
    },
    machine: { 
        network: { 
            location: __dirname + '/../machine',
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
    },
    controller: {}
}

// ######################        /Config          ######################

// ######################        Execution          ######################

async function execution(config) {  
    const context = { 
        targets: [],
        captures: {
            gate: [],
            distance: [],
            warning: []
        }
    };
    
    const monitoring = Client(config.monitoring);
    const controller = Controller(config.controller, monitoring);
    const gate = Gate(config.gate, controller, monitoring);
    const distance = Distance(config.distance, controller, monitoring);
    const machine = Machine(config.machine, controller, monitoring);

    await sleep(2000);
    
    controller.moveMouse(Number(process.env.GAME_POSITION_X), Number(process.env.GAME_POSITION_Y));
    
    await sleep(100);

    controller.click();
    controller.start();
    
    monitoring.logger('{green-fg}##### GAME START #####{/green-fg}');
    
    machine
        .start();

    gate
        .on('capture_match', (capture) => !(Number(process.env.GATE_CAPTURE)) ? null : context.captures.gate.push(capture))
        .on('capture_terminate', (capture) => !(Number(process.env.GATE_CAPTURE)) ? null : context.captures.gate.push(capture))
        .on('terminate', (target) => context.targets.push(target))
        .on('warning', (capture) => {context.capture.warning.push(capture)})
        .on('reload', async () => {
            gate.stop();
            distance.stop();
            controller.stop();

            monitoring.logger('{yellow-fg}##### GAME RELOAD #####{/yellow-fg}');
            monitoring.logger('');

            await saveCaptures(context.captures.warning, 'WARNING', `${__dirname}/../captures/warning/`, monitoring);
            await saveCaptures(context.captures.gate, 'GATE', `${__dirname}/../captures/gate/`, monitoring);
            await saveCaptures(context.captures.distance, 'DISTANCE', `${__dirname}/../captures/distance/`, monitoring);

            await require('util').promisify(setTimeout)(3000);

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

            await saveCaptures(context.captures.warning, 'WARNING', `${__dirname}/../captures/warning/`, monitoring);
            await saveCaptures(context.captures.gate, 'GATE', `${__dirname}/../captures/gate/`, monitoring);
            await saveCaptures(context.captures.distance, 'DISTANCE', `${__dirname}/../captures/distance/`, monitoring);

            await require('util').promisify(setTimeout)(3000);

            process.exit(1);
        })
        .on('scored', () => {
            machine.scored();
        })
        .start(context.targets);
}

execution(config);

// ######################        /Execution          ######################
