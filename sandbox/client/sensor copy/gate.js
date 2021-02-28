const { EventEmitter } = require('events');
const robot = require('robotjs');
const omit = require('lodash/omit');

const { probe, PROBE_TYPES } = require('../../server/monitoring/probe.js');
const { converters } = require('../../utils.js');

robot.setMouseDelay(0)

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
    const emitter = new EventEmitter();

    const TOLERANCE = 10;
    const COMPRESSOR = 2;

    const probeConfig = {
        mute: config.monitoring.mute,
        type: PROBE_TYPES.time,
        name: config.identity, 
        max: converters.nanoseconds(config.frequency),
        threshold: converters.nanoseconds(config.threshold)
    };

    const context = (() => {
        const state = {
            activate: { on: null, off: null },
            position: { x: null, y: null },
            match: false,
            tolerance: 0
        };

        return {
            reset: () => {
                const data = Object.assign({}, omit(state, ['match']))

                state.activate =  { on: null, off: null };
                state.position =  { x: null, y: null };
                state.match = false;
                state.tolerance = 0;

                return data;
            },
            isEnter: () => !!state.activate.on,
            enter: (x, y) => {
                state.activate.on = Date.now();
                state.position = {x, y};

                return true;
            },
            exit: () => {
                if (state.activate.on && !state.match && state.tolerance >= TOLERANCE) { return !!(state.activate.off = Date.now()) }

                if (state.activate.on && !state.match) { state.tolerance++ }

                return false;
            },
            match: (match) => { state.match = match; }
        }
    })()

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

                context.match(false);
                
                const height = Math.trunc((config.size.height - 1) / 3);

                for (let x = 0; x < config.size.width; x++) {
                    if (await (async (context) => {
                        for (let yCompressed = height / COMPRESSOR; yCompressed >= 0; yCompressed--) {
                            const y = yCompressed * COMPRESSOR;
                            const middleY = (height + y) + 1;
                            const bottomY = (2 * height + y) + 2;

                            const topTracker = new Promise((res) => {
                                return res(true === config.tracker.colors.includes(capture.colorAt(x, y)))
                            })

                            const middleTracker = new Promise((res) => {
                                return res(true === config.tracker.colors.includes(capture.colorAt(x, middleY)))
                            })

                            const bottomTracker = new Promise((res) => {
                                return res(true === config.tracker.colors.includes(capture.colorAt(x, bottomY)))
                            })

                            const [top, bottom, middle] = await Promise.all([topTracker, bottomTracker, middleTracker])

                            // robot.moveMouse(capture.converters.absolute.x(x), capture.converters.absolute.y(y));

                            if (top) {
                                context.match(true);

                                if (false === context.isEnter()) { return context.enter(capture.converters.absolute.x(x), capture.converters.absolute.y(y)); }

                                return false;
                            }

                            // robot.moveMouse(capture.converters.absolute.x(x), capture.converters.absolute.y(middleY));

                            if (middle) {
                                context.match(true);

                                if (false === context.isEnter()) { return context.enter(capture.converters.absolute.x(x), capture.converters.absolute.y(middleY)); }

                                return false;
                            }

                            // robot.moveMouse(capture.converters.absolute.x(x), capture.converters.absolute.y(bottomY));

                            if (bottom) {
                                context.match(true);

                                if (false === context.isEnter()) { return context.enter(capture.converters.absolute.x(x), capture.converters.absolute.y(bottomY)); }

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

