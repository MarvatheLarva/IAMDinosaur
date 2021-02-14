const robot = require('robotjs');

async function measure(callback, description) {
    var hrstart = process.hrtime();
    
    await callback();
    
    var hrend = process.hrtime(hrstart);
    console.info(`Execution ${description} time (hr): %ds %dms`, hrend[0], hrend[1] / 1000000)
}

setInterval(async function () {
    await measure(() => {
        const {x, y} = robot.getMousePos();
        console.log({x, y})
        console.log(robot.getPixelColor(x, y));
     }, 'CAPTURE')
}, 50)
