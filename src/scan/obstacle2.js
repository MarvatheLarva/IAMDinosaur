const robot = require('robotjs');

// config: {
//     position: {
//         start: { x: 0, y: 0 },
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
            pixels: []
        }
    }

    let context = Context();

    return async function() {
        const height = config.position.end.y - config.position.start.y;
        const capture = robot.screen.capture(config.position.start.x, config.position.start.y, 1, height);
        const ratioY = capture.height / height;

        let activate = false;
        const pixels = [];

        for(let yRelative = 0; yRelative < height; yRelative++) {
            const yAbsolute = config.position.start.y + yRelative;
            // robot.moveMouse(config.position.start.x, yAbsolute);

            if(config.tracking.colors.includes(capture.colorAt(0, yRelative * ratioY))) {
                if (!context.recording) { context.recording = true; }

                if (context.recording) {
                    if (yAbsolute < context.vertical.max) { context.vertical.max = yAbsolute }

                    if (yAbsolute > context.vertical.min) { context.vertical.min = yAbsolute }
                }
                
                if (!activate) { activate = true }

                pixels.push('x');
            } else {
                pixels.push('  ');
            }
        }

        if (context.recording) {
            context.pixels.push(pixels);
            context.size.width++;
            if (!activate) {
                context.size.height = context.vertical.min - context.vertical.max;
                const element = Object.assign({}, context);

                context = Context();

                return element;
            }
        }
    }
}