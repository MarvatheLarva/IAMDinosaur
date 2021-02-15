const robot = require('robotjs');
const { saveCapture, measure, sleep } = require('./utils');
robot.setMouseDelay(0);
const COLOR_GROUND = 'acacac';
const COLOR_BACKGROUND = '202124';

robot.screen.capture(0, 0, 1, 1);

(async () => {
    function getDino(ground, width) {
        const beforeGround = ground.y - 1;
        const capture = robot.screen.capture(0, beforeGround, width, 1);
    
        const ratioX = width / capture.width;
    
        let found =  false;
        for (let x = 0; x < width; x++) {
            const color = capture.colorAt(x / ratioX, 0);
            if (!found && color === COLOR_GROUND) {
                found = true;
            } else if (found && color === COLOR_BACKGROUND) {
                robot.moveMouse(x, beforeGround);
                return  { x: x , y: beforeGround }
            }
        }
    }

    function getGround(width, height) {
        for (let x = 0; x < width; x++) {
            ground = slice(x, height);
            if (ground) return ground;
        }
    }

    function slice(x, height) {
        const capture = robot.screen.capture(x, 0, 1, height);
        const ratioY = capture.height / height;
        
        for (let y = 0; y < height; y++) {
            const color = capture.colorAt(0, y  * ratioY);
            if (color === COLOR_GROUND) {
                //robot.moveMouse(x, y);
    
                return { x, y, color };
            };
        }
    }

    await measure(async () => {
        //console.log('dbg > Locate dino position.');

        const { width, height } = robot.getScreenSize();

        // Search for specific ground color pixel
        const ground = getGround(width, height);
        console.log('found Ground position at', ground);

        const dino = getDino(ground, width);

        console.log('found Dino position at', dino);
    }, 'Total duration');
})()
.catch((data) => {
    console.log(data);
});
