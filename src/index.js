const robot = require('robotjs');
const { measure } = require('./utils');
const { ScannerObstacle } = require('./scan/obstacle');
const omit = require('lodash/omit');

const DEBUG = false;
const WARNING = true;
const FREQUENCY = 1000/60;
const THRESHOLD = FREQUENCY - FREQUENCY * 0.3;

const TRACKING_COLORS = ['acacac', '535353'];

// @todo COMPUTE those data position
const DINO_POSITION = { x: 80, y: 278 };
const GROUND_POSITION = { x: 1, y: 279 };
const ELEMENT_SCANNER = { start: { x: 490, y: 191 }, end: { x: 490, y: 276 }};

robot.screen.capture(0, 0, 1, 1)

robot.setMouseDelay(0);

function initState() {
    return {
        run: false,
        pixels: [],
        y: {
            min: 0,
            max: 100000
        }
    }
}

function Scanner(config) {
    let state = initState();

    return {
        element: async () => {
            const height = ELEMENT_SCANNER.end.y - ELEMENT_SCANNER.start.y;
            const capture = robot.screen.capture(ELEMENT_SCANNER.start.x, ELEMENT_SCANNER.start.y, 1, height);
            const ratioY = capture.height / height;

            let activate = false;
            let pixels = [];

            for(let yRelative = 0; yRelative < height; yRelative++) {
                const yAbsolute = ELEMENT_SCANNER.start.y + yRelative;
                //robot.moveMouse(ELEMENT_SCANNER.start.x, yAbsolute);
                const color = capture.colorAt(0, yRelative * ratioY);

                if(TRACKING_COLORS.includes(color)) {
                    if (!state.run)
                        state.run = true;

                    if (state.run) {
                        pixels.push({x: ELEMENT_SCANNER.start.x, y: yAbsolute})
                        if (yAbsolute < state.y.max)
                            state.y.max = yAbsolute;

                        if (yAbsolute > state.y.min)
                            state.y.min = yAbsolute;
                    }
                    
                    if (!activate)
                        activate = true;
                }
            }

            if (state.run) {
                state.pixels.push(pixels);
                if (!activate) {
                    const element = Object.assign({},omit(state, ['pixels']), { width: state.pixels.length, height: state.y.min - state.y.max});
                    state = initState();
    
                    return element;
                }
            }
        },
        distance: async (element) => {
            const yRelative = element.vertical.min - (element.size.height / 2);
            const width = ELEMENT_SCANNER.start.x - DINO_POSITION.x;
            const capture = robot.screen.capture(DINO_POSITION.x, yRelative, width, 1);
            const ratioX = capture.width / width;

            for (let xRelative = 0; xRelative < width; xRelative++) {
                const color = capture.colorAt(xRelative * ratioX , 0);
                if (TRACKING_COLORS.includes(color)) {
                    // robot.moveMouse(DINO_POSITION.x + xRelative, yRelative);

                    return xRelative;
                }
            }

            return 0;
        }
    }
}

(async() => {
    const context = {
        current: null,
        elements: [],
        passthrough: false
    };

    const scannerConfig = {};

    const scanner2 = Scanner(scannerConfig);

    const scanner = ScannerObstacle({
        position: ELEMENT_SCANNER,
        tracking: {
            colors: TRACKING_COLORS
        }
    });

    const tick = setInterval(async () => {
        const log = {
            debug: DEBUG,
            warning: WARNING
        }

        await measure(async () => {
            await measure(async () => {
                const element = await scanner();
                if (element) { 
                    // console.log(element.size);
                    context.elements.push(element)
                }
            }, 'Scan Element incoming', log);

            if (!context.current && context.elements.length) {
                context.current = context.elements.shift();
                context.currentWidth = context.current.size.width;
                // console.log(context.current);
            }

            if (context.current) {
                await measure(async () => {
                    const distance = await scanner2.distance(context.current);
                    // process.stdout.write(`${ distance } px remaing\n`);
                    // console.log('distance: ', distance);
                    if (!context.passthrough && 0 === distance) {
                        context.passthrough = true;
                    }

                    if (context.passthrough) {
                        // console.log('width', context.currentWidth);
                        if (context.currentWidth === 0) {
                            context.current = null;
                            context.passthrough = false;
                        } else {
                            context.currentWidth--;
                        }
                    }
                }, 'Scan Distance from Element', log)
            }
        }, 'Tick', log, THRESHOLD)
    }, FREQUENCY);
})()