const robot = require('robotjs');
const { saveCapture, measure, sleep } = require('./utils');
robot.setMouseDelay(0);

(async () => {
    await measure(async () => {
        console.log('dbg > Locate dino position.');
        const COLOR = '535353';
        
        const { width, height } = robot.getScreenSize();

        await measure(async () => {
            // Search for specific color pixel
            for (let x = 0; x < width; x++) {
                for (let y = 1; y < height; y++) {
                    const color = robot.getPixelColor(x, y);
                    robot.moveMouse(x, y);
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
