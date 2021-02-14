const robot = require('robotjs');
const { measure } = require('./utils');

const DEBUG = false;
const WARNING = true;
const THRESHOLD = 14;
const FREQUENCY = 16;

const TRACKING_COLORS = ['acacac', '535353'];
const DINO_POSITION = { x: 49, y: 282 };
const GROUND_POSITION = { x: 1, y: 283 };
const ELEMENT_SCANNER = { start: { x: 444, y: 191 }, end: { x: 444, y: 274 }};

robot.screen.capture(0, 0, 1, 1);
robot.setMouseDelay(0);

function Scanner(config) {
    function initState() {
        return {
            run: false,
            pixels: [],
            max: null,
            min: 100000,
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
                // robot.moveMouse(ELEMENT_SCANNER.start.x, ELEMENT_SCANNER.start.y + y);
                const color = capture.colorAt(0, y * ratioY);

                if(TRACKING_COLORS.includes(color)) {
                    if (!state.run) {
                        state.run = true;
                    }

                    if (state.run) {
                        pixels.push({x: ELEMENT_SCANNER.start.x, y: ELEMENT_SCANNER.start.y + y})
                        if (ELEMENT_SCANNER.start.y + y > state.max) {
                            state.max = ELEMENT_SCANNER.start.y + y;
                        }

                        if (ELEMENT_SCANNER.start.y + y < state.min) {
                            state.min = ELEMENT_SCANNER.start.y + y;
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
                const element = Object.assign({}, state);
                state = initState();

                return element;
            };
        },
        distance: async (element) => {
            console.log(element.min, element.max);
            return 0;
        }
    }
}

(async() => {
    const context = {
        current: null,
        elements: []
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
                    context.current ? context.elements.push(element) : context.current = element;
                }
            }, 'Scan Element incoming', log);
        
                // console.log(context);

            if (context.current) {
                await measure(async () => {
                    const distance = await scanner.distance(context.current);
                    if (0 === distance) { context.current = context.elements.shift() }
                }, 'Scan Distance from Element', log)
            }
        }, 'Tick', log, THRESHOLD)
    }, FREQUENCY);
})()