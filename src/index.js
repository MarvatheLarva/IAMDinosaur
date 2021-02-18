const { Gate, Distance, Scanner } = require('./sensor');
const udp = require('dgram');

const PROBE_SERVER_ADDRESS = '0.0.0.0';
const PROBE_SERVER_PORT = 2222;

const GLOBAL_FREQUENCY = 1000/250; // millisecondds
const GLOBAL_THRESHOLD = GLOBAL_FREQUENCY * 0.7; // Threshold at  70% of max frequency

const client = ((client) => (data) => {
    const buffer = Buffer.from(JSON.stringify(data));

    client.send(buffer, PROBE_SERVER_PORT, PROBE_SERVER_ADDRESS)
})(udp.createSocket('udp4'))

const gateConfig = {
    monitoring: { client },
    frequency: GLOBAL_FREQUENCY,
    threshold: GLOBAL_THRESHOLD,
    tracker: { colors: ['acacac', '535353'] },
    size: { width: 1, height: 80 },
}

const gateA = Gate(Object.assign({
    identity: 'Gate A',
    position: { x: 490, y: 190 },
}, gateConfig));

const gateB = Gate(Object.assign({
    identity: 'Gate B',
    position: { x: 390, y: 190 },
}, gateConfig));

const distanceMetter = Distance({});

const scanner = Scanner({});


//


const current = null;
const elements = [];

gateA((state) => {
    console.log(state);
    const element = state;

    if (!current)
        current = state
    else
        elements.push(state)

    scanner(element)
})

gateB((state) => {
    console.log(state);
})

distanceMetter((compute) => {
    compute(current);
})