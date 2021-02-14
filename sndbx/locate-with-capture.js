const robot = require('robotjs');
const { saveCapture, measure, sleep } = require('../src/utils');
robot.setMouseDelay(0);

(async () => {
    await measure(async () => {
        console.log('dbg > Locate dino position.');
        const COLOR = '535353';
        
        let initCapture, capture, width, height = 0;

        await measure(() => {
            const data = robot.getScreenSize();
            width = data.width;
            height = data.height;

            initCapture = robot.screen.capture(0, 0, width, height);
        }, 'Init Capture');

        await saveCapture(initCapture, './snaps')
        // process.exit();

        await measure(async () => {
            // Search for specific color pixel
            for (let x = 0; x < initCapture.width; x++) {
                // Create a capture for faster processing
                // await measure(() => {
                //     capture = robot.screen.capture(x, 1, 600, 500);
                // }, 'capture');

                // Compute ratio between screen's and capture's sizes
                const ratioX = width / initCapture.width;
                const ratioY = height / initCapture.height;

                for (let y = 1; y < initCapture.height; y++) {
                    // console.log(x * ratioX, y * ratioY);
                    const color = initCapture.colorAt(x, y);
                    robot.moveMouse(x * ratioX, y * ratioY);
                    if (color === '535353') {
                        return console.log({x, y, color});
                    };
                }
            }
        }, 'SCAN FOR first color point');
        

        console.log('found Dino position at', {});
    }, 'Total duration');
})()
.catch((data) => {
    console.log(data);
});
