const robot = require('robotjs');

function initContext() {
    return {
        recording: false,
        vertical: {
            min: 0,
            max: Infinity,
            height: 0
        },
        horizontal: {
            width: 0
        }
    };
}

// config: {
//     position: {
//         start: { x: 0, y: 0 },
//         end: { x: 0, y: 0 }
//     },
//     tracking: {
//         colors: []
//     }
// }
exports.ScannerObstacle = (config) => {
    let context = initContext();
    console.log(context);

    return async () => {
        const height = config.position.end.y - config.position.start.y;
        const capture = robot.screen.capture(config.position.start.x, config.position.start.y, 1, height);
        const ratioY = capture.height / height;

        let activate = false;

        for(let yRelative = 0; yRelative < height; yRelative++) {
            const yAbsolute = config.position.start.y + yRelative;
            robot.moveMouse(config.position.start.x, yAbsolute);

            if(config.tracking.colors.includes(capture.colorAt(0, yRelative * ratioY))) {
                if (!context.recording) { context.recording = true }

                if (context.recording) {
                    if (yAbsolute < context.vertical.max) { context.vertical.max = yAbsolute }

                    if (yAbsolute > context.vertical.min) { context.vertical.min = yAbsolute }
                }
                
                if (!activate) { activate = true }
            }
        }

        if (context.recording) {
            context.horizontal.width++;

            if (!activate) {
                context.vertical.height = context.vertical.min - context.vertical.max;
                const element = Object.assign({}, context);

                context = initContext();

                return element;
            }
        }
    }
}