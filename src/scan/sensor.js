const { EventEmitter } = require('events');
const robot = require('robotjs');
const omit = require('lodash/omit');


const COMPRESSOR = 2;
const FREQUENCY = 1000/130;

// config: {
//     identity: string,
//     tracker: { colors: [] },
//     position: {
//         x: number,
//         y: number
//     },
//     size: {
//         width: number,
//         height: number,
//     }
// }

exports.Sensor = (config) => {
    const emitter = new EventEmitter();
    const state = ((initialState) => {
        let localState = Object.assign({}, initialState);

        return {
            reset: () => {
                const data = Object.assign({}, omit(localState, ['match']))
                localState = Object.assign({}, initialState)
                    return data;
            },
            isActive: () => !!localState.on,
            onActivate: (x, y) => {
                localState.on = Date.now();
                localState.position = {x, y};
            },
            offActivate: () => localState.off = Date.now(),
            match: () => localState.match = true,
            unmatch: () => localState.match = false,
            finish: () => {
                if (localState.on && !localState.match) {
                    localState.off = Date.now();

                    return true;
                }

                return false;
            }
        }
    })({
        // activate: {
            on: null, // null || Date.now()
            off: null, // null || Date.now()
        // },
        position: { x: null, y: null },
        match: false
    })

    emitter.on('start', () => {
        setInterval(() => {
            measure(() => {
                const capture = ((x, y, width, height) => {
                    const screenCapture = robot.screen.capture(x, y, width, height);
                    const converters = {
                        relative: {
                            x: (absolute) => absolute - x,
                            y: (absolute) => absolute - y,
                        },
                        absolute: {
                            x: (relative) => x + relative,
                            y: (relative) => y + relative,
                        }
                    }
                    const ratio = {
                        x: screenCapture.width / width,
                        y: screenCapture.height / height,
                    };

                    return {
                        screen: screenCapture,
                        colorAt: (x, y) => {
                            return screenCapture.colorAt(x * ratio.x, y * ratio.y)
                        },
                        ratio,
                        converters
                    }
                })(config.position.x, config.position.y, config.size.width, config.size.height);

                state.unmatch();

                for (let x = 0; x < config.size.width; x++) {
                    if (((state) => {
                        for (let yCompressed = 0; yCompressed < config.size.height / COMPRESSOR; yCompressed++) {
                            const y = yCompressed * COMPRESSOR;

                            if (true === config.tracker.colors.includes(capture.colorAt(x, y))) {
                                state.match();

                                if (false === state.isActive()) {
                                    state.onActivate(capture.converters.absolute.x(x), capture.converters.absolute.y(y));

                                    return true;
                                }

                                return false;
                            }
                        }
                        return false;
                    })(state)) {
                        break;
                    }
                }

                if (true === state.finish()) {
                    emitter.emit('activation', Object.assign({}, state.reset()));
                }

            }, { debug: false, warning: true, name: `sensor-${config.identity}`, threshold: FREQUENCY * 0.9 })
        }, FREQUENCY);
    })

    return (onActivation) => {
        emitter
            .on('activation', onActivation)
            .emit('start');
    }
}

function measure(func, config) {
    const start = process.hrtime.bigint();
    
    func();

    const end = process.hrtime.bigint();

    const ms = Math.trunc(Number(end - start) / 1000000);

    if (config.debug) {
        console.info(`Execution ${config.name} time: %dms`, ms)
    }

    if (config.warning && config.threshold && ms > config.threshold) {
        console.info(`WARNING - Execution ${config.name} time: %dms > %dms`, ms, Math.trunc(config.threshold))
    }
}

// // Example
// const sensorA = Sensor({
//     identity: 'A',
//     tracker: { colors: ['acacac', '535353'] },
//     position: { x: 490, y: 191 },
//     size: { width: 1, height: 85 }
// });

// sensorA((state) => {
//     // (process / store) state, for next step
// })