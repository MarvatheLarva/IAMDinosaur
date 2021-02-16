const { Sensor } = require('./scan/sensor');

// Example
const sensorA = Sensor({
    identity: 'A',
    tracker: { colors: ['acacac', '535353'] },
    position: { x: 490, y: 191 },
    size: { width: 1, height: 85 }
});

sensorA((state) => {
    console.log(state);
})