const Jimp = require('jimp');
const robot = require('robotjs');

exports.saveCapture = async (capture, path, suffix) => {
    return new Promise((resolve, reject) => {
        try {
            const filename = `${Date.now()} - ${suffix || '' }`;
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

exports.Capture = (x, y, width, height) => {
    const screenCapture = robot.screen.capture(x, y, width, height);
    const converters = {
        relative: { x: (absolute) => absolute - x, y: (absolute) => absolute - y },
        absolute: { x: (relative) => x + relative, y: (relative) => y + relative }
    }
    const ratio = { x: screenCapture.width / width, y: screenCapture.height / height };

    return {
        screen: screenCapture,
        colorAt: (x, y) => { return screenCapture.colorAt(x * ratio.x, y * ratio.y) },
        ratio,
        converters
    }
}