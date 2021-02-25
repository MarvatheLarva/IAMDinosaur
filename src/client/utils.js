const robot = require('../../build/Release/robot');

function bitmap(width, height, byteWidth, bitsPerPixel, bytesPerPixel, image) 
{
    this.width = width;
    this.height = height;
    this.byteWidth = byteWidth;
    this.bitsPerPixel = bitsPerPixel;
    this.bytesPerPixel = bytesPerPixel;
    this.image = image;

    this.colorAt = function(x, y)
    {
        return robot.getColor(this, x, y);
    };

}

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

            require('fs').mkdirSync(path, {recursive: true});
            require('fs').writeFileSync(`${path}/${filename}.html`, `<html><body style="background:red;">${pixelsShit.join('')}</body></html>`);
            resolve(true);
        } catch (e) {
            console.error(e);
            reject(e);
        }
    });
}

exports.Capture = (x, y, width, height) => {
    capture = function(x, y, width, height) {
        //If coords have been passed, use them.
        if (typeof x !== "undefined" && typeof y !== "undefined" && typeof width !== "undefined" && typeof height !== "undefined")
        {
            b = robot.captureScreen(x, y, width, height);
        }
        else 
        {
            b = robot.captureScreen();
        }

        return new bitmap(b.width, b.height, b.byteWidth, b.bitsPerPixel, b.bytesPerPixel, b.image);
    };

    const screenCapture = capture(x, y, width, height);

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

exports.MoveMouse = (ignore) => (x, y) => {
    robot.setMouseDelay(0);
    ignore ? null : robot.moveMouse(x, y);
}