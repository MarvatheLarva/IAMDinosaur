const { Gate, Distance, Scanner } = require('./sensor');

const udp = require('dgram');

const PROBE_SERVER_ADDRESS = '0.0.0.0';
const PROBE_SERVER_PORT = 2222;

const GLOBAL_FREQUENCY = 1000/200; // millisecondds
const GLOBAL_THRESHOLD = GLOBAL_FREQUENCY * 0.7; // Threshold at  70% of max frequency

const GATE_A_X = 480;
const GATE_A_Y = 194;

const GATE_B_X = 300;
const GATE_B_Y = 194;

const GATE_HEIGHT = 81;

const client = ((client) => (data) => {
    const buffer = Buffer.from(JSON.stringify(data));

    client.send(buffer, PROBE_SERVER_PORT, PROBE_SERVER_ADDRESS)
})(udp.createSocket('udp4'))

const commonConfig = {
    monitoring: { client },
    frequency: GLOBAL_FREQUENCY,
    threshold: GLOBAL_THRESHOLD,
    tracker: { colors: ['acacac', '535353'] },
}

const gateA = Gate(Object.assign({
    identity: 'Gate A',
    position: { x: GATE_A_X, y: GATE_A_Y },
    size: { width: 1, height: GATE_HEIGHT }
}, commonConfig));

const gateB = Gate(Object.assign({
    identity: 'Gate B',
    position: { x: GATE_B_X, y: GATE_B_Y },
    size: { width: 1, height: GATE_HEIGHT }
}, commonConfig));

const scanner = Scanner(Object.assign({
    identity: 'Scanner',
    size: { height: GATE_HEIGHT / 2, width: 50},
    position: { x: 50 + GATE_B_X, y: GATE_A_Y }
}, commonConfig));

const distanceMetter = Distance(Object.assign({
    identity: 'Distance metter',
}, commonConfig));


//

const statesGateA = [];

const targetsScan = [];
const targetsSpeed = [];

gateA(async (stateGateA) => {
    console.log('GATE A');
    statesGateA.push(stateGateA);
    targetsScan.push(await scanner({
        // config
        position: stateGateA.position,
    }))

})

gateB((stateGateB) => {
    console.log('GATE B');
    const stateGateA = statesGateA.shift();
    if (!stateGateA) { console.log('GATE A missing'); return;}

    targetsSpeed.push((stateGateB.activate.on - stateGateA.activate.on) / (GATE_A_X - GATE_B_X));
    // console.log(targetsScan, targetsSpeed)
    // statesGateB.push(stateGateB);
})

// const target = null;

// distanceMetter((compute) => {
//     if (!target && (!targetsScan.length || !targetsSpeed.length)) return;

//     if (!target) {
//         target = Object.assign({}, targetsScan.shift(), { speed: targetsSpeed.shift() });
//     }

//     const distance = compute(target);

//     // generate full element payload
//     const element = Object.assign({}, target, { distance })


// })
