const robot = require('robotjs');
const { probe, PROBE_TYPES } = require('../monitoring/probe.js');
const { converters, saveCapture } = require('../utils.js');

exports.Scanner = (config) => {
    const COMPRESSOR = 2;

    const probeConfig = {
        type: PROBE_TYPES.time,
        name: config.identity, 
        max: converters.nanoseconds(config.frequency),
        threshold: converters.nanoseconds(config.threshold)
    };

    let count = 0;

    return async (context) => {
        // console.log('SCAN', context)
        let width = 'TODO';
        let height = 'TODO';
        let origin = 'TODO';

        await probe(probeConfig, config.monitoring.client, async () => {
            // await require('util').promisify(setTimeout)(4);
            const capture = robot.screen.capture(config.position.x, Math.max(context.position.y - config.size.height / 2, config.position.y), config.size.width, config.size.height);

            for (let y = config.size.width / COMPRESSOR; y >= 0; y--) {
                let count = 0;
                for (let x = config.size.height / COMPRESSOR; x >= 0; x--) {
                    if (count > config.size.height / COMPRESSOR / 2) { break };
                    // console.log('no escape');
                    const color = capture.colorAt(x * COMPRESSOR, y * COMPRESSOR)
                    if (config.tracker.colors.includes(color)) {
                        count = 0;
                    } else {
                        count++;
                    }
                }
            }
            // saveCapture(capture, './');
        });

        return  {
            width, height, origin
        }
    }
}