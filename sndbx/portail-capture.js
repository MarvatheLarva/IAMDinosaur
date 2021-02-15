const robot = require('robotjs');
const { saveCapture, measure, sleep } = require('./utils');
robot.setMouseDelay(0);
const COLOR_GROUND = '535353';
const COLOR_BACKGROUND = 'ffffff';

robot.screen.capture(0, 0, 1, 1);

(async () => {
    // await measure(async () => {
        //console.log('dbg > Locate dino position.');

        // const screenSize = robot.getScreenSize();
        const position = {x: 547, y: 191};
        const positionEnd = {x: 547, y: 270};
        const scan = {
            running: false,
            pixels: []
        };

        const interval = setTimeout(async () => {
            await measure(async () => {
                const height = positionEnd.y - position.y;
                const capture = robot.screen.capture(position.x, position.y, 1, height);
                const ratioY = capture.height / height;
                let activate = false;
                for(let y = 0; y < height; y++) {
                    // robot.moveMouse(position.x, position.y + y);
                    const color = capture.colorAt(0, y * ratioY);
                    console.log(color);
                    if(COLOR_GROUND === color) {
                        if (!scan.running) {
                            scan.running = true;
                            // console.log('START REC');
                        }

                        if (scan.running)
                            scan.pixels.push({x: position.x, y: position.y + y})

                        if (!activate) {
                            activate = true;
                        }
                    }
                }

                if (!activate) {
                    // console.log('STOP REC');
                    // console.log(scan);
                    scan.running = false;
                    scan.pixels = [];
                };
    
            }, 'Scanning');
        }, 16)

    // }, 'Total duration');
})()
.catch((data) => {
    console.log(data);
});
