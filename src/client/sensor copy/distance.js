const robot = require('robotjs');
const { probe, PROBE_TYPES } = require('../../server/monitoring/probe.js');
const { converters, Capture } = require('../../utils.js');

robot.setMouseDelay(0);

exports.Distance = (config) => {
    const COMPRESSOR = 4;

    const probeConfig = {
        mute: config.monitoring.mute,
        type: PROBE_TYPES.time,
        name: config.identity, 
        max: converters.nanoseconds(config.frequency),
        threshold: converters.nanoseconds(config.threshold)
    };

    function compute(element) {
        // init capture on config.position.x, (element.height + origin) / 2
        // loop over it to find tracker color
        const capture = Capture(config.position.x, config.position.y - (element.height / 2 + element.origin), config.size.width, 1);
        for (let xCompressed = 0; xCompressed < config.size.width / COMPRESSOR; xCompressed++) {
            const x = xCompressed * COMPRESSOR;

            if (config.tracker.colors.includes(capture.colorAt(x, 0))) {
                // robot.moveMouse(capture.converters.absolute.x(x), capture.converters.absolute.y(0));

                return x;
            }
        }

        return config.size.width;
    }

    return (callback) => {
        const interval = setInterval(() => {
            probe(probeConfig, config.monitoring.client, async () => {
                callback(compute);
            });
        }, config.frequency);
    }
}
