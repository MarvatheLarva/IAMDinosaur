const { Gate, Distance, Scanner } = require('./sensor');

const udp = require('dgram');
const readline = require('readline');

const { PROBE_TYPES } = require('./monitoring/probe');

const PROBE_SERVER_ADDRESS = '0.0.0.0';
const PROBE_SERVER_PORT = 2222;

const GLOBAL_FREQUENCY = 3; // millisecondds
const GLOBAL_THRESHOLD = GLOBAL_FREQUENCY * 0.7; // Threshold at 70% of frequency

const GATE_A_X = 480;
const GATE_A_Y = 194;

const GATE_B_X = 300;
const GATE_B_Y = 194;

const GATE_HEIGHT = 81;

const DISTANCE_METTER_X = 80;
const DISTANCE_METTER_Y = 278;
const DISTANCE_METTER_WIDTH = GATE_B_X - DISTANCE_METTER_X;

const GATE_A_MONITORING_MUTE = true;
const GATE_B_MONITORING_MUTE = true;
const SCANNER_MONITORING_MUTE = true;
const DISTANCE_METTER_MONITORING_MUTE = true;

readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);
process.stdin.on('keypress', (str, key) => { if (key.name === 'q') process.exit() })

const client = ((client) => (data) => {
    const buffer = Buffer.from(JSON.stringify(data));

    client.send(buffer, PROBE_SERVER_PORT, PROBE_SERVER_ADDRESS)
})(udp.createSocket('udp4'));

const logger = ((client) => (content, channel = 'main logs') => {
    client({ type: PROBE_TYPES.log, name: channel, content })
})(client);

const commonConfig = {
    logger,
    frequency: GLOBAL_FREQUENCY,
    threshold: GLOBAL_THRESHOLD,
    tracker: { colors: ['acacac', '535353'] },
}

const gateA = Gate(Object.assign({}, commonConfig, {
    monitoring: { client, mute: GATE_A_MONITORING_MUTE },
    identity: 'Gate A',
    position: { x: GATE_A_X, y: GATE_A_Y },
    size: { width: 1, height: GATE_HEIGHT }
}));

const gateB = Gate(Object.assign({}, commonConfig, {
    monitoring: { client, mute: GATE_B_MONITORING_MUTE },
    identity: 'Gate B',
    position: { x: GATE_B_X, y: GATE_B_Y },
    size: { width: 1, height: GATE_HEIGHT }
}));

const scanner = Scanner(Object.assign({}, commonConfig, {
    monitoring: { client, mute: SCANNER_MONITORING_MUTE },
    max: 10,
    threshold: 8,
    identity: 'Scanner',
    size: { height: 115, width: 80},
    position: { x: GATE_A_X - 80, y: GATE_A_Y - 35 }
}));

const distanceMetter = Distance(Object.assign({}, commonConfig, {
    monitoring: { client, mute: DISTANCE_METTER_MONITORING_MUTE },
    identity: 'Distance metter',
    position: { x: DISTANCE_METTER_X, y: DISTANCE_METTER_Y },
    size: { width: DISTANCE_METTER_WIDTH }
}));


//

const statesGateA = [];

const targetsScan = [];
const targetsSpeed = [];

gateA(async (stateGateA) => {   
    logger('-> activate GATE A');

    statesGateA.push(stateGateA);
    scanner({
        ident: 'gate A',
        // config
    }).then(scan => targetsScan.push(scan))
})

gateB(async (stateGateB) => {
    logger('-> activate GATE B');

    const stateGateA = statesGateA.shift();

    if (!stateGateA) { logger('{red-fg}-> error GATE A missing{/red-fg}'); return;}

    targetsSpeed.push((GATE_A_X - GATE_B_X) / (stateGateB.activate.on - stateGateA.activate.on));
})

let target = null;
let passthrough = false;

distanceMetter((compute) => {
    if (!target && (!targetsScan.length || !targetsSpeed.length)) return;
    
    if (!target) {
        target = Object.assign({}, targetsScan.shift(), { speed: targetsSpeed.shift() });
        logger(`-> Init Distance metter`);
        logger(`{yellow-fg}${JSON.stringify(target, null, 0)}{/yellow-fg}`);
    }

    const distance = compute(target);
    logger(`-> distance : ${distance}`)

    if (!passthrough && 0 === distance) passthrough = true;

    if (passthrough && distance > 0) {
        passthrough = false;
        target = null;
    }

    // // generate full element payload
    // const element = Object.assign({}, target, { distance })

})
