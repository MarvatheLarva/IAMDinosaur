const Jimp = require('jimp');

exports.saveCapture = async (capture, path) => {
    return new Promise((resolve, reject) => {
        try {
            const filename = Date.now();
            const image = new Jimp(capture.width, capture.height);
            let pos = 0;
            image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
                image.bitmap.data[idx + 2] = capture.image.readUInt8(pos++);
                image.bitmap.data[idx + 1] = capture.image.readUInt8(pos++);
                image.bitmap.data[idx + 0] = capture.image.readUInt8(pos++);
                image.bitmap.data[idx + 3] = capture.image.readUInt8(pos++);
            });
            image.write(`${path}/${filename}.jpg`, resolve);
        } catch (e) {
            console.error(e);
            reject(e);
        }
    });
}

exports.measure = async (callback, description) => {
    const hrstart = process.hrtime();
    
    await callback();

    const hrend = process.hrtime(hrstart);
    
    console.info(`Execution ${description} time (hr): %ds %dms`, hrend[0], hrend[1] / 1000000)
}

exports.sleep = require('util').promisify(setTimeout);