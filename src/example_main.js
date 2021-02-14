const robot = require('robotjs');
const { measure } = require('./utils');
const omit = require('lodash/omit');

const DEBUG = false;
const WARNING = true;
const THRESHOLD = 14;
const FREQUENCY = 16;

const TRACKING_COLORS = ['acacac', '535353'];

// @todo COMPUTE those data position
const DINO_POSITION = { x: 80, y: 278 };
const GROUND_POSITION = { x: 1, y: 279 };
const ELEMENT_SCANNER = { start: { x: 490, y: 191 }, end: { x: 490, y: 272 }};

robot.screen.capture(0, 0, 1, 1);
robot.setMouseDelay(0);

function Scanner(config) {
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
    let state = initState();

    return {
        element: async () => {
            const height = ELEMENT_SCANNER.end.y - ELEMENT_SCANNER.start.y;
            const capture = robot.screen.capture(ELEMENT_SCANNER.start.x, ELEMENT_SCANNER.start.y, 1, height);
            const ratioY = capture.height / height;
            let activate = false;
            let pixels = [];

            for(let y = 0; y < height; y++) {
                const yPosition = ELEMENT_SCANNER.start.y + y;
                // robot.moveMouse(ELEMENT_SCANNER.start.x, yPosition);
                const color = capture.colorAt(0, y * ratioY);

                if(TRACKING_COLORS.includes(color)) {
                    if (!state.run) {
                        state.run = true;
                    }

                    if (state.run) {
                        pixels.push({x: ELEMENT_SCANNER.start.x, y: yPosition})
                        if (yPosition < state.y.max) {
                            state.y.max = yPosition;
                        }

                        if (yPosition > state.y.min) {
                            state.y.min = yPosition;
                        }
                    }
                    
                    if (!activate) {
                        activate = true;
                    }
                }
            }

            if (state.run)
                state.pixels.push(pixels);
            
            if (state.run && !activate) {
                const element = Object.assign({},omit(state, ['pixels']), { width: state.pixels.length, height: state.y.min - state.y.max});
                state = initState();

                return element;
            };
        },
        distance: async (element) => {
            // console.log(element);
            // process.stdout.write(`width: ${element.width} / height: ${element.height}\n`);
            const yPosition = element.y.min - element.height/2;
            const width = ELEMENT_SCANNER.start.x - DINO_POSITION.x;

            //robot.moveMouse(DINO_POSITION.x, yPosition);

            const capture = robot.screen.capture(DINO_POSITION.x, yPosition, width, 1);
            const ratioX = capture.width / width;
            for (let x = 0; x < width; x++) {
                const color = capture.colorAt(x * ratioX , 0);
                if (TRACKING_COLORS.includes(color)) {
                    robot.moveMouse(DINO_POSITION.x + x, yPosition);

                    return x;
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

    const scanner = Scanner(scannerConfig);

    const tick = setInterval(async () => {
        const log = {
            debug: DEBUG,
            warning: WARNING
        }

        await measure(async () => {
            await measure(async () => {
                const element = await scanner.element();
                if (element) {
                    context.elements.push(element);
                }
            }, 'Scan Element incoming', log);

            if (!context.current && context.elements.length) {
                context.current = context.elements.shift();
                context.currentWidth = context.current.width;
                //console.log(context.current);
            }

            if (context.current) {
                await measure(async () => {
                    const distance = await scanner.distance(context.current);
                    // process.stdout.write(`${ distance } px remaing\n`);
                    //console.log('distance: ', distance);
                    if (!context.passthrough && 0 === distance) {
                        context.passthrough = true;
                    }

                    if (context.passthrough) {
                        //console.log('width', context.currentWidth);
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