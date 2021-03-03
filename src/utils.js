const uuid = require('uuid');
const fs = require('fs');

async function saveCapture(capture, path) {
    const filename = `${Date.now()}`;
    const pixelsShit = [];
    for (let y = 0; y < capture.height; y++) {
        for (let x = 0; x < capture.width; x++) {
            pixelsShit.push(`<div style="width:1px;height:1px;position:absolute;top:${y}px;left:${x}px;background:#${capture.colorAt(x, y)};"></div>`);
        }
    }

    fs.mkdirSync(path, { recursive: true });
    fs.writeFileSync(`${path}/${filename}.html`, `<html><body style="background:red;">${pixelsShit.join('')}</body></html>`);
}


async function saveCaptures(captures, name, path, monitoring) {
    const uniq = uuid.v4();
    if (captures.length) { console.log(uniq) }

    if (captures.length) { monitoring.logger(`{white-fg}[CAPTURE][${name}]: start saving{/white-fg}`) }
    for (const capture of captures) {
        if  (capture) { await saveCapture(capture.screen, `${path}/${uniq}`) }
    }
    if (captures.length) { monitoring.logger(`{green-fg}[CAPTURE][${name}]: success save ${path}/${uniq}{/green-fg}`) }
}

const converters = {
    nanoseconds: (milliseconds) => milliseconds * 1000000,
    milliseconds: (nanoseconds) => nanoseconds / 1000000
}

exports.converters = converters;
exports.saveCapture = saveCapture;
exports.saveCaptures = saveCaptures;