const robot = require('robotjs');
const { saveCapture, Capture } = require('../../utils.js');

robot.setMouseDelay(0);

// USEFULL FOR HEIGHT & GROUND DISTANCE
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
exports.Scanner = (config, monitoring) => {
    return async () => {
        const state = {
            width: '?',
            height: '?',
            origin: '?'
        }

        await monitoring.stopwatch(config.identity, config.monitoring.stopwatch, async () => {
            const capture = Capture(config.position.x, config.position.y, config.size.width, config.size.height);
            // saveCapture(capture.screen, './');
            const computeHeight = new Promise(async (res, rej) => {
                let [top, bottom] = [null, null];
                for (let yTopCompressed = 0; yTopCompressed < (config.size.height) / config.compressor; yTopCompressed++) {
                    const yTop = yTopCompressed * config.compressor;
                    const yBottom = Math.max((config.size.height - 1) - yTop, 0);
                    
                    for (let xLeftCompressed = 0; xLeftCompressed < (config.size.width) / config.compressor; xLeftCompressed++) {
                        const xLeft = xLeftCompressed * config.compressor;
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

            const computeWidth = new Promise((res, rej) => {
                let left = null;
                let right = null;

                for (let xLeftCompressed = 0; xLeftCompressed < (config.size.width) / config.compressor; xLeftCompressed++) {
                    const xLeft = xLeftCompressed * config.compressor;
                    const xRight = Math.max((config.size.width  - 1) - xLeft, 0);
        
                    for (let yTopCompressed = 0; yTopCompressed < (config.size.height) / config.compressor; yTopCompressed++) {
                        const yTop = yTopCompressed * config.compressor;
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

            const [computedHeight, computedWidth] = await Promise.all([computeHeight, computeWidth])

            monitoring.logger('-> Scanner done');


            state.height = computedHeight.height;
            state.origin = computedHeight.groundDistance;
            state.width = computedWidth;
        });

        return Object.assign({}, state);
    }
}