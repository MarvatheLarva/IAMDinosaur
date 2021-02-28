const robot = require('robotjs');
const { probe, PROBE_TYPES } = require('../../server/monitoring/probe.js');
const { converters, saveCapture, Capture } = require('../../utils.js');

robot.setMouseDelay(0);

exports.Scanner = (config) => {
    const COMPRESSOR = 2;

    const probeConfig = {
        mute: config.monitoring.mute,
        type: PROBE_TYPES.time,
        name: config.identity, 
        max: converters.nanoseconds(config.max),
        threshold: converters.nanoseconds(config.threshold)
    };

    return async (context) => {
        const state = {
            width: '?',
            height: '?',
            origin: '?'
        }

        await probe(probeConfig, config.monitoring.client, async () => {
            const capture = Capture(config.position.x, config.position.y, config.size.width, config.size.height);

            // USEFULL FOR HEIGHT
            //   ▶ [ ,  ,  ,  ,  ,  ,  ,  ,  ,  ,  ]
            //     [ ,  ,  ,  ,  ,  ,  ,  ,  ,  ,  ]
            //     [ ,  ,  ,  ,  , X, X,  ,  ,  ,  ]
            //     [ ,  ,  ,  ,  , X, X,  ,  , X, X]
            //     [ ,  ,  ,  ,  ,  , X, X, X,  ,  ]
            //     [ ,  ,  ,  ,  ,  ,  , X, X,  ,  ]
            //     [ ,  ,  ,  ,  ,  ,  , X, X,  ,  ]
            //     [ ,  ,  ,  ,  ,  ,  ,  ,  ,  ,  ]
            //     [ ,  ,  ,  ,  ,  ,  ,  ,  ,  ,  ]
            //     [ ,  ,  ,  ,  ,  ,  ,  ,  ,  ,  ] ◀
            const computeHeight = new Promise(async (res, rej) => {
                let [top, bottom] = [null, null];
                for (let yTopCompressed = 0; yTopCompressed < (config.size.height) / COMPRESSOR; yTopCompressed++) {
                    const yTop = yTopCompressed * COMPRESSOR;
                    const yBottom = Math.max((config.size.height - 1) - yTop, 0);
                    
                    for (let xLeftCompressed = 0; xLeftCompressed < (config.size.width) / COMPRESSOR; xLeftCompressed++) {
                        const xLeft = xLeftCompressed * COMPRESSOR;
                        const xRight = Math.max((config.size.width  - 1) - xLeft, 0);
                        
                        if (null === top && config.tracker.colors.includes(capture.colorAt(xLeft, yTop))) {top = yTop}
                        if (null === bottom && config.tracker.colors.includes(capture.colorAt(xRight, yBottom))) {bottom = yBottom}

                        // robot.moveMouse(capture.converters.absolute.x(xLeft), capture.converters.absolute.y(yTop))
                        // robot.moveMouse(capture.converters.absolute.x(xRight), capture.converters.absolute.y(yBottom))

                        if (null !== top && null !== bottom) return res({height: bottom - top, groundDistance: config.size.height - bottom})
                    }
                }
                console.log(top, bottom);
                rej('ERROR');
            })

            // USEFULL FOR WIDTH
            //      ▼ 
            //     [ ,  ,  ,  ,  ,  ,  ,  ,  ,  ,  ]
            //     [ ,  ,  ,  ,  ,  ,  ,  ,  ,  ,  ]
            //     [ ,  ,  ,  ,  , X, X,  ,  ,  ,  ]
            //     [ ,  ,  ,  ,  , X, X,  ,  , X, X]
            //     [ ,  ,  ,  ,  ,  , X, X, X,  ,  ]
            //     [ ,  ,  ,  ,  ,  ,  , X, X,  ,  ]
            //     [ ,  ,  ,  ,  ,  ,  , X, X,  ,  ]
            //     [ ,  ,  ,  ,  ,  ,  ,  ,  ,  ,  ]
            //     [ ,  ,  ,  ,  ,  ,  ,  ,  ,  ,  ]
            //     [ ,  ,  ,  ,  ,  ,  ,  ,  ,  ,  ]
            //                                    ▲
            const computeWidth = new Promise((res, rej) => {
                let left = null;
                let right = null;

                for (let xLeftCompressed = 0; xLeftCompressed < (config.size.width) / COMPRESSOR; xLeftCompressed++) {
                    const xLeft = xLeftCompressed * COMPRESSOR;
                    const xRight = Math.max((config.size.width  - 1) - xLeft, 0);
        
                    for (let yTopCompressed = 0; yTopCompressed < (config.size.height) / COMPRESSOR; yTopCompressed++) {
                        const yTop = yTopCompressed * COMPRESSOR;
                        const yBottom = Math.max((config.size.height - 1) - yTop, 0);

                        if (null === left && config.tracker.colors.includes(capture.colorAt(xLeft, yTop))) {left = xLeft}
                        if (null === right && config.tracker.colors.includes(capture.colorAt(xRight, yBottom))) {right = xRight}

                        // robot.moveMouse(capture.converters.absolute.x(xLeft), capture.converters.absolute.y(yTop))
                        // robot.moveMouse(capture.converters.absolute.x(xRight), capture.converters.absolute.y(yBottom))

                        if (null !== left && null !== right) return res(right - left)
                    }
                }
                console.log(left, right);
                rej('ERROR');
            });

            // saveCapture(capture.screen, './', context.ident);

            const [computedHeight, computedWidth] = await Promise.all([computeHeight, computeWidth])

            config.logger('-> Scanner done')

            state.height = computedHeight.height;
            state.origin = computedHeight.groundDistance;
            state.width = computedWidth;
        });

        return Object.assign({}, state);
    }
}