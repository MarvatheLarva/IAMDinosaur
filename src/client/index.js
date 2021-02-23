const { Terminal } = require('./terminal');
const { Machine } = require('./machine');
const { Game } = require('./game');
const { Monitoring } = require('./monitoring');

(() => {
    const MONITORING_SERVER_ADDRESS = '0.0.0.0';
    const MONITORING_SERVER_PORT = 2222;
    
    const MACHINE_FOLDER = __dirname+'/../../machine';
    
    const TRACKING_COLORS = ['acacac', '535353'];
    
    const GLOBAL_MUTE = true;
    const GLOBAL_COMPRESSOR = 2;
    const GLOBAL_FREQUENCY = 3; // millisecondds
    const GLOBAL_THRESHOLD = GLOBAL_FREQUENCY * 0.7; // Threshold at 70% of frequency

    const GATE_A_X = 480;
    const GATE_A_Y = 194;

    const GATE_B_X = 300;
    const GATE_B_Y = 194;

    const GATE_TOLERANCE = 10;

    const GATE_WIDTH = 1;
    const GATE_HEIGHT = 81;

    const SCANNER_X = GATE_A_X - 80;
    const SCANNER_Y = GATE_A_Y - 35;

    const SCANNER_WIDTH = 80;
    const SCANNER_HEIGHT = 115;

    const DISTANCE_METTER_X = 80;
    const DISTANCE_METTER_Y = 278;

    const DISTANCE_METTER_WIDTH = GATE_B_X - DISTANCE_METTER_X;
    const DISTANCE_METTER_HEIGHT = 1;

    const STATUS_TRACKING = {
        init: {
            positions: [{ x: 28, y: 230 }, { x: 40, y: 230 }, { x: 50, y: 230 }],
            tracker: { colors: TRACKING_COLORS }
        },
        running: {
            positions: [{ x: 58, y: 244 }],
            tracker: { colors: ['ffffff'] }
        },
        gameover: {
            positions: [{ x: 155, y: 189 }, { x: 173, y: 189 }, { x: 200, y: 189 }, { x: 226, y: 189 }, { x: 274, y: 189 }, { x: 295, y: 189 }, { x: 320, y: 189 }, { x: 345, y: 189 }],
            tracker: { colors: TRACKING_COLORS }
        }
    };

    const converters = {
        nanoseconds: (milliseconds) => milliseconds * 1000000,
        milliseconds: (nanoseconds) => nanoseconds / 1000000
    }

    Terminal(() => {
        const commonMonitoring = { server: { address: MONITORING_SERVER_ADDRESS, port: MONITORING_SERVER_PORT}};

        const statusMonitoring = Object.assign({}, commonMonitoring, { stopwatch: { max: converters.nanoseconds(1000), threshold: converters.nanoseconds(900), mute: GLOBAL_MUTE } });
        const gateMonitoring = Object.assign({}, commonMonitoring, { stopwatch: { max: converters.nanoseconds(GLOBAL_FREQUENCY), threshold: converters.nanoseconds(GLOBAL_THRESHOLD), mute: GLOBAL_MUTE } });
        const distanceMonitoring = Object.assign({}, commonMonitoring, { stopwatch: { max: converters.nanoseconds(GLOBAL_FREQUENCY), threshold: converters.nanoseconds(GLOBAL_THRESHOLD), mute: GLOBAL_MUTE } });
        const scannerMonitoring = Object.assign({}, commonMonitoring, { stopwatch: { max: converters.nanoseconds(GLOBAL_FREQUENCY), threshold: converters.nanoseconds(GLOBAL_THRESHOLD), mute: GLOBAL_MUTE } });

        const sensor = {
            status: { identity: 'Game status', frequency: GLOBAL_FREQUENCY, positions: STATUS_TRACKING, compressor: GLOBAL_COMPRESSOR, monitoring: statusMonitoring },
            gate: {
                a: { identity: 'Gate A', tracker: { colors: TRACKING_COLORS }, frequency: GLOBAL_FREQUENCY, position: { x: GATE_A_X, y: GATE_A_Y }, size: { width: GATE_WIDTH, height: GATE_HEIGHT }, compressor: GLOBAL_COMPRESSOR, tolerance: GATE_TOLERANCE, monitoring: gateMonitoring },
                b: { identity: 'Gate B', tracker: { colors: TRACKING_COLORS }, frequency: GLOBAL_FREQUENCY, position: { x: GATE_B_X, y: GATE_B_Y }, size: { width: GATE_WIDTH, height: GATE_HEIGHT }, compressor: GLOBAL_COMPRESSOR, tolerance: GATE_TOLERANCE, monitoring: gateMonitoring }
            },
            scanner: { identity: 'Scanner', tracker: { colors: TRACKING_COLORS }, position: { x: SCANNER_X, y: SCANNER_Y }, size: { width: SCANNER_WIDTH, height: SCANNER_HEIGHT }, compressor: GLOBAL_COMPRESSOR, monitoring: scannerMonitoring },
            distance: { identity: 'Distance', tracker: { colors: TRACKING_COLORS }, frequency: GLOBAL_FREQUENCY, position: { x: DISTANCE_METTER_X, y: DISTANCE_METTER_Y }, size: { width: DISTANCE_METTER_WIDTH, height: DISTANCE_METTER_HEIGHT }, compressor: GLOBAL_COMPRESSOR, monitoring: distanceMonitoring },
        };

        const monitoring = Monitoring(MONITORING_SERVER_ADDRESS, MONITORING_SERVER_PORT);

        const machine = Machine(MACHINE_FOLDER, monitoring);

        const game = Game(sensor, monitoring)
            .on('gameover', (data) => {
                game.stop();
                machine.compute(data);
                game.start(machine.genome)
            });

        return [ game, machine ];
    })
    .on('quit', (game, machine) => {
        game.stop();
        machine.stop();
        process.exit();
    })
    .on('start', (game, machine) => {
        game.start(machine.genome);
    })
})()
