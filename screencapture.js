const Jimp = require('jimp');
const { measure } = require('./utils');
const { exec } = require("child_process");
(async () => {
    await measure(async () => {
        await require('util').promisify(exec)("screencapture -t jpg -R '0,0,1,1' test.jpg");
        const data = await Jimp.read("./test.jpg");
        console.log(data.getPixelColour(0, 0));
    }, 'Screen capture + read (1px)');

    await measure(async () => {
        await require('util').promisify(exec)("screencapture -t jpg -R '0,0,1,1' test.jpg");
        const data = await Jimp.read("./test.jpg");
        console.log(data.getPixelColour(0, 0));
    }, 'Screen capture + read (1px)');
})()
