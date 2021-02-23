const robot = require('robotjs');
const { Capture } = require('iamdino/utils.js');

robot.setMouseDelay(0);

exports.Distance = (config, monitoring) => {
    function compute(element) {
        // init capture on config.position.x, (element.height + origin) / 2
        // loop over it to find tracker color
        const capture = Capture(config.position.x, config.position.y - (element.height / 2 + element.origin), config.size.width, 1);
        for (let xCompressed = 0; xCompressed < config.size.width / config.compressor; xCompressed++) {
            const x = xCompressed * config.compressor;

            if (config.tracker.colors.includes(capture.colorAt(x, 0))) {
                // robot.moveMouse(capture.converters.absolute.x(x), capture.converters.absolute.y(0));

                return x;
            }
        }

        return config.size.width;
    }

    return (callback) => {
        return setInterval(() => {
            monitoring.stopwatch(config.identity, config.monitoring.stopwatch, async () => {
                callback(compute);
            });
        }, config.frequency);
    }
}
