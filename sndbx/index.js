const robot = require('robotjs');
const { measure } = require('./utils');
const { Obstacle } = require('./scan/obstacle');

const DEBUG = true;
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

async function saveElement(pixels, name) {
    let data = '';

    for (let y = 0; y < pixels[0].length; y++) {
        let line = [];
        for (let x = 0; x < pixels.length; x++) {
            line.push(pixels[x][y]);
        }
        if (line.filter(e => e  === 'x').length)
            data += `${line.join('')}\n\r`;
    }

    require('fs').writeFile(`./elements/${name}.txt`, data, () => {});
}

async function saveElement2(pixels, name) {
    require('fs').writeFile(`./elements/${name}.txt`, pixels.map(e => e.join('')).join('\n\r'), () => {});
}

function Scanner(config) {
    return {
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

    const scanObscacle = Obstacle({
        position: ELEMENT_SCANNER,
        tracking: {
            colors: TRACKING_COLORS
        }
    });
    let count = 0;
    const tick = setInterval(async () => {
        const log = {
            debug: DEBUG,
            warning: WARNING
        }

        await measure(async () => {
            await measure(async () => {
                const element = await scanObscacle();
                if (element) { 
                    // count++;
                    // saveElement(element.pixels, `${count}-tracing`);
                    // saveElement2(element.pixelsCaptured, `${count}-captured`);
                    // context.elements.push(element)
                }
            }, 'Scan-Element-incoming', log);

            if (!context.current && context.elements.length) {
                context.current = context.elements.shift();
                context.currentWidth = context.current.size.width;
                // console.log(context.current);
            }

            // if (context.current) {
            //     await measure(async () => {
            //         const distance = await scanner2.distance(context.current);
            //         // process.stdout.write(`${ distance } px remaing\n`);
            //         // console.log('distance: ', distance);
            //         if (!context.passthrough && 0 === distance) {
            //             context.passthrough = true;
            //         }

            //         if (context.passthrough) {
            //             // console.log('width', context.currentWidth);
            //             if (context.currentWidth === 0) {
            //                 context.current = null;
            //                 context.passthrough = false;
            //             } else {
            //                 context.currentWidth--;
            //             }
            //         }
            //     }, 'Scan Distance from Element', log)
            // }
        }, 'Tick', log, THRESHOLD)
    }, FREQUENCY);
})()