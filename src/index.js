const { Gate, Distance, Scanner } = require('./sensor');

const udp = require('dgram');
const readline = require('readline');
const {PROBE_TYPES}=require('./monitoring/probe');

const PROBE_SERVER_ADDRESS = '0.0.0.0';
const PROBE_SERVER_PORT = 2222;

const GLOBAL_FREQUENCY = 3; // millisecondds
const GLOBAL_THRESHOLD = GLOBAL_FREQUENCY * 0.7; // Threshold at  70% of max frequency

const GATE_A_X = 480;
const GATE_A_Y = 194;

const GATE_B_X = 300;
const GATE_B_Y = 194;

const GATE_HEIGHT = 81;

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
    monitoring: { client },
    logger,
    frequency: GLOBAL_FREQUENCY,
    threshold: GLOBAL_THRESHOLD,
    tracker: { colors: ['acacac', '535353'] },
}

const gateA = Gate(Object.assign({}, commonConfig, {
    identity: 'Gate A',
    position: { x: GATE_A_X, y: GATE_A_Y },
    size: { width: 1, height: GATE_HEIGHT }
}));

const gateB = Gate(Object.assign({}, commonConfig, {
    identity: 'Gate B',
    position: { x: GATE_B_X, y: GATE_B_Y },
    size: { width: 1, height: GATE_HEIGHT }
}));

const scanner = Scanner(Object.assign({}, commonConfig, {
    max: 10,
    threshold: 8,
    identity: 'Scanner',
    size: { height: GATE_HEIGHT, width: 80},
    position: { x: GATE_A_X - 80, y: GATE_A_Y }
}));

// const scanner2 = Scanner(Object.assign({}, commonConfig, {
//     max: 10,
//     threshold: 8,
//     identity: 'Scanner',
//     size: { height: GATE_HEIGHT, width: 80},
//     position: { x: GATE_B_X - 80, y: GATE_B_Y }
// }));

const distanceMetter = Distance(Object.assign({
    identity: 'Distance metter',
}, commonConfig));


//

const statesGateA = [];

const targetsScan = [];
const targetsSpeed = [];

gateA(async (stateGateA) => {
    // console.log('GATE A');
    
    logger('-> activate GATE A');

    // console.log(stateGateA);
    statesGateA.push(stateGateA);
    targetsScan.push(await scanner({
        ident: 'gate A',
        // config
        position: stateGateA.position,
    }))
})

gateB(async (stateGateB) => {
    // console.log('GATE B');

    logger('-> activate GATE B');

    // console.log(stateGateB);
    const stateGateA = statesGateA.shift();

    if (!stateGateA) { logger('{red-fg}-> error GATE A missing{/red-fg}'); return;}
    // console.log(stateGateB.activate.on - stateGateA.activate.on);
    targetsSpeed.push((GATE_A_X - GATE_B_X) / (stateGateB.activate.on - stateGateA.activate.on));
    
    // await scanner2({
    //     ident: 'gate B',
    //     // config
    //     position: stateGateB.position,
    // })
    // console.log(targetsScan, targetsSpeed)
    // statesGateB.push(stateGateB);
})

let target = null;

distanceMetter((compute) => {
    if (!target && (!targetsScan.length || !targetsSpeed.length)) return;

    if (!target) {
        target = Object.assign({}, targetsScan.shift(), { speed: targetsSpeed.shift() });
        logger(`-> Init Distance metter`);
        logger(`{yellow-fg}${JSON.stringify(target)}{/yellow-fg}`);
    }

    // const distance = compute(target);

    // // generate full element payload
    // const element = Object.assign({}, target, { distance })

})
