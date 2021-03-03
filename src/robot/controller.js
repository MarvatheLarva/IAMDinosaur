const robotjs = require('robotjs');

robotjs.setMouseDelay(0);
robotjs.setKeyboardDelay(0);

exports.Controller = function(config, monitoring) {
    const context = {
        state: {
            start: false
        },
        jumpToggle: null,
        crouchToggle: null,
    };

    return Object.assign({}, {
        jump: () => {
            if (!context.state.start) { return }

            if (!context.jumpToggle) {
                robotjs.keyToggle('down', 'up');
                robotjs.keyTap('up');

                context.jumpToggle = setTimeout(() => {
                    context.jumpToggle = null;
                }, 50)
            }

            context.crouchToggle = clearTimeout(context.crouchToggle);
        },
        crouch: () => {
            if (!context.state.start) { return }

            context.jumpToggle = clearTimeout(context.jumpToggle);
            
            if (!context.crouchToggle) { robotjs.keyToggle('down', 'down') }

            context.crouchToggle = clearTimeout(context.crouchToggle);
            context.crouchToggle = setTimeout(() => {
                context.crouchToggle = clearTimeout();
                robotjs.keyToggle('down', 'up');
            }, 500)
        },
        moveMouse: (x, y) => {
            robotjs.moveMouse(x, y);
        },
        click: () => {
            robotjs.mouseClick('left');
        },
        capture: (x, y, width, height) => {
            const screenCapture = robotjs.screen.capture(x, y, width, height);
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
        },
        start: () => {
            context.state.start = true;
            robotjs.keyTap('up');
        },
        stop: () => {
            context.state.start = false;
        }
    })
};