const robot = require('robotjs');
const { saveCapture, measure, sleep } = require('../src/utils');
robot.setMouseDelay(0);

(async () => {
    await measure(async () => {
        console.log('dbg > Locate dino position.');
        const COLOR_GROUND = '535353';
        const COLOR_BACKGROUND = 'ffffff';

        let capture, ground = null;
        const { width, height } = robot.getScreenSize();

        await measure(async () => {
            // Search for specific color pixel
            for (let y = 0; y < height; y++) {
                capture = robot.screen.capture(0, y, 25, 1);

                const ratioX = 50 / capture.width;

                for (let x = 0; x < 50; x++) {
                    const color = capture.colorAt(x / ratioX, 1);
                    if (color === COLOR_GROUND) {
                        robot.moveMouse(x, y);

                        return ground = { x, y, color };
                    };
                }
            }
        }, 'SCAN FOR first color point');
        
        console.log('found Ground position at', ground);

        let dino = null;
        capture = robot.screen.capture(0, ground.y, width, 1);

        const ratioX = width / capture.width;

        for (let x = 0; x < width; x++) {
            const color = capture.colorAt(x / ratioX, 1);
            if (color === COLOR_BACKGROUND) {
                robot.moveMouse(x, ground.y);
                dino = { x: x * ratioX, y: ground.y }

                return;
            };
        }

        console.log('found Dino position at', dino);
    }, 'Total duration');
})()
.catch((data) => {
    console.log(data);
});
