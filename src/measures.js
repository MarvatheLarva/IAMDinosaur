const robot = require('robotjs');
let Jimp = require('jimp');

robot.setMouseDelay(0);
robot.getPixelColor(1, 1);

async function measure(callback) {
    var hrstart = process.hrtime();
    
    await callback();
    
    var hrend = process.hrtime(hrstart);

    return Math.trunc(hrend[1] / 1000000);
}

function screenCaptureToFile2(robotScreenPic, path) {
    return new Promise((resolve, reject) => {
        try {
            const image = new Jimp(robotScreenPic.width, robotScreenPic.height);
            let pos = 0;
            image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
                image.bitmap.data[idx + 2] = robotScreenPic.image.readUInt8(pos++);
                image.bitmap.data[idx + 1] = robotScreenPic.image.readUInt8(pos++);
                image.bitmap.data[idx + 0] = robotScreenPic.image.readUInt8(pos++);
                image.bitmap.data[idx + 3] = robotScreenPic.image.readUInt8(pos++);
            });
            image.write(path, resolve);
        } catch (e) {
            console.error(e);
            reject(e);
        }
    });
}

setInterval(async function () {
    let duration = 0;
    let capture;
    
    duration += await measure(() => { capture = robot.screen.capture(273, 323, 1000, 1) }, 'CAPTURE H')
    
    if (robot.getPixelColor(677, 199) === '535353') {
        console.log('GAME OVER');
        process.exit()
    };

    // console.log(capture);
    // process.exit();
    // await screenCaptureToFile2(capture, './snap.jpg')
    
    //duration += await measure(() => { robot.screen.capture(0, 0, 600, 1) }, 'CAPTURE V')

    // duration += await measure(async () => Promise.all([
    //     (async () => { capture = robot.screen.capture(0, 0, 2, 295) })(),
    //     (async () => { robot.screen.capture(0, 0, 600, 1) })()
    // ]));
    
    // using map
    duration += await measure(
        async () => {
            const ratioX = 1000 / capture.width;
            const ratioY = 1 / capture.height;
            let y = 0;
            //for (let y = 0; y < capture.height; y++) {
                for (let x = 0; x < capture.width; x++) {
                    // console.log(capture.colorAt(x, y));
                    
                    // compute distance from dino to direct obstacle
                    if (capture.colorAt(x , y) === '535353') {
                        robot.moveMouse(273 + (x * ratioX), 323)
                        //console.log('hit', x);
                        break;
                    }
                    // else {
                    //     process.stdout.write('.');
                    // }
    
                    // await require('util').promisify(setTimeout)(10)
                }
                //process.stdout.write('\n');
            //}
        }
    )

    if (duration > 14) {
        console.log('wARNING duration:', duration);
    } else {
        //console.log(duration);
    }

    // // using loop for
    // await measure(
    //     () => { for (let y = 0; y < 10; y++) (capture.colorAt(2, y)) },
    //     'loop FOR'
    // )

    // // using map
    // await measure(
    //     () => new Array(10).fill().map((v, y) => (capture.colorAt(2, y))),
    //     'loop MAP'
    // )
}, 16)
