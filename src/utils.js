const Jimp = require('jimp');

exports.saveCapture = async (capture, path) => {
    return new Promise((resolve, reject) => {
        try {
            const filename = Date.now();
            const pixelsShit = [];
            for (let y = 0; y < capture.height; y++) {
                const captured = [];
                for (let x = 0; x < capture.width; x++) {
                    pixelsShit.push(`<div style="width:1px;height:1px;position:absolute;top:${y}px;left:${x}px;background:#${capture.colorAt(x, y)};"></div>`);
                }
            }

            require('fs').writeFile(`${path}/${filename}.html`, `<html><body style="background:red;">${pixelsShit.join('')}</body></html>`, () => {});
        } catch (e) {
            console.error(e);
            reject(e);
        }
    });
}

exports.measure = async (callback, description, log, threshold) => {
    const hrstart = process.hrtime();
    
    await callback();

    const hrend = process.hrtime(hrstart);
    
    if (log && log.debug)
        console.info(`Execution ${description} time (hr): %ds %dms`, hrend[0], Math.trunc(hrend[1] / 1000000))
    if (log && log.warning && threshold && threshold < (hrend[0] * 1000 + hrend[1] / 1000000))
        console.info(`WARNING - Execution ${description} time (hr): %ds %dms`, hrend[0], Math.trunc(hrend[1] / 1000000))

    require('fs').writeFile(`./debug-${description}.log`, `time ${hrend[0]}s ${Math.trunc(hrend[1] / 1000000)}ms`, () => {})
}

exports.sleep = require('util').promisify(setTimeout);

exports.Context = (initContext) => {
    let context = Object.assign({}, initContext);

    return {
        context,
        resetContext: () => {
            return context = Object.assign({}, initContext);
        }
    }
}

exports.converters = {
    nanoseconds: (milliseconds) => milliseconds * 1000000,
    milliseconds: (nanoseconds) => nanoseconds / 1000000
}
