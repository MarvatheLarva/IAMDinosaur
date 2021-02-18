const { EventEmitter } = require('events');
const robot = require('robotjs');
const omit = require('lodash/omit');

const { probe, PROBE_TYPES } = require('../monitoring/probe.js');
const { converters } = require('../utils.js');

// config: {
//     identity: string,
//     frequency: number,
//     threshold: number,
//     tracker: { colors: [] },
//     position: {
//         x: number,
//         y: number
//     },
//     size: {
//         width: number,
//         height: number,
//     },
//     probe: {
//         client: Function
//     }
// }

exports.Gate = (config) => {
    const COMPRESSOR = 3;

    const emitter = new EventEmitter();
    const context = (() => {
        const state = {
            activate: { on: null, off: null },
            position: { x: null, y: null },
            match: false
        };

        return {
            reset: () => {
                const data = Object.assign({}, omit(state, ['match']))

                state.activate =  { on: null, off: null },
                state.position =  { x: null, y: null },
                state.match = false
                
                return data;
            },
            isEnter: () => !!state.activate.on,
            enter: (x, y) => {
                state.activate.on = Date.now();
                state.position = {x, y};
            },
            exit: () => {
                if (state.activate.on && !state.match) {
                    state.activate.off = Date.now();

                    return true;
                }

                return false;
            }
        }
    })()

    const probeConfig = {
        type: PROBE_TYPES.time,
        name: config.identity, 
        max: converters.nanoseconds(config.frequency),
        threshold: converters.nanoseconds(config.threshold)
    };

    emitter.on('start', () => {
        setInterval(() => {
            probe(probeConfig, config.monitoring.client, async () => {
                const capture = ((x, y, width, height) => {
                    const screenCapture = robot.screen.capture(x, y, width, height);
                    const converters = {
                        relative: { x: (absolute) => absolute - x, y: (absolute) => absolute - y },
                        absolute: { x: (relative) => x + relative, y: (relative) => y + relative }
                    }
                    const ratio = { x: screenCapture.width / width, y: screenCapture.height / height };

                    return {
                        screen: screenCapture,
                        colorAt: (x, y) => { return screenCapture.colorAt(x * ratio.x, y * ratio.y) },
                        ratio,
                        converters
                    }
                })(config.position.x, config.position.y, config.size.width, config.size.height);

                context.match = false;

                for (let x = 0; x < config.size.width; x++) {
                    if (((context) => {
                        for (let yCompressed = 0; yCompressed < config.size.height / COMPRESSOR; yCompressed++) {
                            const y = yCompressed * COMPRESSOR;

                            if (true === config.tracker.colors.includes(capture.colorAt(x, y))) {
                                context.match = true;

                                if (false === context.isEnter()) {
                                    context.enter(capture.converters.absolute.x(x), capture.converters.absolute.y(y));

                                    return true;
                                }

                                return false;
                            }
                        }
                        return false;
                    })(context)) {
                        break;
                    }
                }

                if (true === context.exit()) { emitter.emit('activation', Object.assign({}, context.reset())) }

            })
        }, config.frequency);
    })

    return (onActivation) => {
        emitter
            .on('activation', onActivation)
            .emit('start');
    }
}

