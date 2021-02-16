const robot = require('robotjs');

// config: {
//     position: {
//         start: { x: 0, x: 0 },
//         end: { x: 0, y: 0 }
//     },
//     tracking: {
//         colors: []
//     }
// }
exports.Obstacle = (config) => {
    function Context() {
        return {
            recording: false,
            vertical: {
                min: 0,
                max: Infinity,
            },
            size: {
                height: 0,
                width: 0
            },
            // pixels: [],
            pixelsCaptured: [],
            captureObstacle: null,
        }
    }
    let count = 0;

    let context = Context();

    return async function() {
        const height = config.position.end.y - config.position.start.y;
        const capture = robot.screen.capture(config.position.start.x, config.position.start.y, 1, height);
        const ratioY = capture.height / height;

        let activate = false;
        // const pixels = [];

        for(let yRelative = 0; yRelative < height; yRelative++) {
            const yAbsolute = config.position.start.y + yRelative;
            // robot.moveMouse(config.position.start.x, yAbsolute);

            if(config.tracking.colors.includes(capture.colorAt(0, yRelative * ratioY))) {
                if (!context.recording) {
                    context.recording = true;
                }

                if (context.recording) {
                    if (yAbsolute < context.vertical.max) { context.vertical.max = yAbsolute }

                    if (yAbsolute > context.vertical.min) { context.vertical.min = yAbsolute }
                }
                
                if (!activate) { activate = true }

                // pixels.push('x');
            } 
            // else {
            //     pixels.push(' ');
            // }
        }

        if (context.recording) {

            // context.pixels.push(pixels);
            context.size.width++;
            if (!activate) {
                context.size.height = context.vertical.min - context.vertical.max;
                
                // ###########
                const captureObstacleSize = {
                    width: 100,
                    height: (context.vertical.min - context.vertical.max) || 100
                }
                
                const captureObstaclePosition = {
                    x: config.position.start.x - captureObstacleSize.width,
                    y: context.vertical.max
                }
                
                context.captureObstacle = robot.screen.capture(captureObstaclePosition.x, captureObstaclePosition.y, captureObstacleSize.width, captureObstacleSize.height);

            //     saveCapture(context.captureObstacle)

            const rY = context.captureObstacle.height / captureObstacleSize.height;
            const rX = context.captureObstacle.width / captureObstacleSize.width;
            // const pixelsShit = [];
            // for (let y = 0; y < captureObstacleSize.height; y++) {
            //     const captured = [];
            //     for (let x = 0; x < captureObstacleSize.width; x++) {
            //         pixelsShit.push(`<div style="width:1px;height:1px;position:absolute;top:${y}px;left:${x}px;background:#${context.captureObstacle.colorAt(x * rX, y * rY)};"></div>`);
            //     }
            // }

            // count++;
            // require('fs').writeFile('./'+count+'.html', `<html><body>${pixelsShit.join('')}</body></html>`, () => {});

            for (let y = 0; y < captureObstacleSize.height; y++) {
                const captured = [];
                for (let x = 0; x < captureObstacleSize.width; x++) {
                    // config.tracking.colors.includes(context.captureObstacle.colorAt(x * rX, y * rY))
                    // captured.push(config.tracking.colors.includes(context.captureObstacle.colorAt(x * rX, y * rY)) ? 'x' : ' ');
                }
                context.pixelsCaptured.push(captured);
            }
// ###########

                const element = Object.assign({}, context);

                context = Context();

                return element;
            }
        }
    }
}