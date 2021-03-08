require('dotenv').config();

const { PROBE } = require('./monitoring');
const { converters } = require('./utils');

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
    },
}

// Config
const config = {
    game: {
        position: { x: Number(process.env.GAME_POSITION_X), y: Number(process.env.GAME_POSITION_Y) }
    },
    monitoring: {
        address: process.env.MONITORING_SERVER_ADDRESS,
        port: Number(process.env.MONITORING_SERVER_PORT)
    },
    player: {
        frequency: Number(process.env.PLAYER_FREQUENCY),
        scanner: {
            vertical: {
                size: { width: Number(process.env.PLAYER_VERTICAL_SIZE_WIDTH), height: Number(process.env.PLAYER_VERTICAL_SIZE_HEIGHT) },
                position: { x: Number(process.env.PLAYER_VERTICAL_POSITION_X), y: Number(process.env.PLAYER_VERTICAL_POSITION_Y) },
            },
            horizontal: {
                size: { width: Number(process.env.PLAYER_HORIZONTAL_SIZE_WIDTH), height: Number(process.env.PLAYER_HORIZONTAL_SIZE_HEIGHT) },
                position: { x: Number(process.env.PLAYER_HORIZONTAL_POSITION_X), y: Number(process.env.PLAYER_HORIZONTAL_POSITION_Y) },
            }
        }
    },
    gate: {
        capture: Number(process.env.PLAYER_VERTICAL_CAPTURE),
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
        capture: Number(process.env.DISTANCE_CAPTURE),
        frequency: Number(process.env.DISTANCE_FREQUENCY),
        compressor: Number(process.env.DISTANCE_COMPRESSOR),
        timeout: Number(process.env.DISTANCE_TIMEOUT),
        position: { x: Number(process.env.DISTANCE_POSITION_X), y: Number(process.env.DISTANCE_POSITION_Y) },
        size: { width: Number(process.env.DISTANCE_SIZE_WIDTH), height: Number(process.env.DISTANCE_SIZE_HEIGHT) },
        tracker: { colors: process.env.TRACKING_COLORS.split(', ') },
        monitoring: configMonitoring.distance,
        controller: { mouse: Number(process.env.DISTANCE_MOUSE) }
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
                speed: Number(process.env.MACHINE_MAX_SPEED),
                player: Number(process.env.PLAYER_MAX_ORIGIN)
            }
        },
        monitoring: configMonitoring.machine
    },
}

exports.configMonitoring = configMonitoring;
exports.config = config;