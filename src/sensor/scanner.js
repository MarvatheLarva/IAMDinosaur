const robot = require('robotjs');
const { probe, PROBE_TYPES } = require('../monitoring/probe.js');
const { converters, saveCapture } = require('../utils.js');

exports.Scanner = (config) => {
    const COMPRESSOR = 2;

    const probeConfig = {
        type: PROBE_TYPES.time,
        name: config.identity, 
        max: converters.nanoseconds(config.max),
        threshold: converters.nanoseconds(config.threshold)
    };

    let count = 0;

    return async (context) => {
        // console.log('SCAN', context)
        let width = '?';
        let height = '?';
        let origin = '?';

        await probe(probeConfig, config.monitoring.client, async () => {
            // await require('util').promisify(setTimeout)(4);
            const capture = robot.screen.capture(config.position.x, config.position.y, config.size.width, config.size.height);

            const computeHeight = new Promise((res) => {
                return res('x');
            })

            const computeWidth = new Promise((res) => {
                return res('x');
            })

            const computeOrigin = new Promise((res) => {
                return res('x');
            })

            const data = await Promise.all([computeHeight, computeWidth, computeOrigin])

            // for (let y = config.size.width / COMPRESSOR; y >= 0; y--) {
            //     let count = 0;
            //     for (let x = config.size.height / COMPRESSOR; x >= 0; x--) {
            //         if (count > config.size.height / COMPRESSOR / 2) { break };
            //         // console.log('no escape');
            //         const color = capture.colorAt(x * COMPRESSOR, y * COMPRESSOR)
            //         if (config.tracker.colors.includes(color)) {
            //             count = 0;
            //         } else {
            //             count++;
            //         }
            //     }
            // }
            saveCapture(capture, './', context.ident);
            config.logger('-> Scanner done')

            width = data[0];
            height = data[1];
            origin = data[2];
        });

        return  {
            width, height, origin
        }
    }
}