const { EventEmitter } = require('events');
const { saveCapture } = require('../utils');

exports.Player = function(config, controller, monitoring) {
    const context = {
        emitter: new EventEmitter(),
        interval: null,
        start: false,
        locked: false,
        state: {
            origin: null
        },
        pattern1: [
            'acacac', '2a2a2a', '2a2a2a', '2a2a2a', '2a2a2a', 'acacac',
            'acacac', '000000', '000000', '000000', '000000', 'acacac',
            'acacac', '000000', '000000', '000000', '000000', 'acacac',
            'acacac', '000000', '000000', '000000', '000000', 'acacac',
            'acacac', '828282', '828282', '828282', '828282', 'acacac',
        ],
        pattern2: [
            'acacac', '2a2a2a', '2a2a2a', '2a2a2a', '2a2a2a', 'acacac',
            'acacac', '000000', '000000', '000000', '000000', 'acacac',
            'acacac', '000000', '000000', '000000', '000000', 'acacac',
            'acacac', '000000', '000000', '000000', '000000', 'acacac',
            'acacac', '000000', '000000', '000000', '000000', 'acacac',
            'acacac', '828282', '828282', '828282', '828282', 'acacac',
        ],
        pattern3: [
            "acacac", "acacac", "2a2a2a", "2a2a2a", "2a2a2a", "2a2a2a", "acacac", "acacac",
            "acacac", "acacac", "000000", "000000", "000000", "000000", "acacac", "acacac",
            "acacac", "acacac", "000000", "000000", "000000", "000000", "acacac", "acacac",
            "acacac", "acacac", "000000", "000000", "000000", "000000", "acacac", "acacac",
            "acacac", "acacac", "828282", "828282", "828282", "828282", "acacac", "acacac",
        ],
        pattern4: [
            "535353", "535353", "535353", "535353", "535353", "535353",
            "535353", "ffffff", "ffffff", "ffffff", "ffffff", "535353",
            "535353", "ffffff", "ffffff", "ffffff", "ffffff", "535353",
            "535353", "ffffff", "ffffff", "ffffff", "ffffff", "535353",
            "535353", "ffffff", "ffffff", "ffffff", "ffffff", "535353",
            "535353", "535353", "535353", "535353", "535353", "535353",
        ],
        pattern5: [
            "535353", "535353", "535353", "535353", "535353", "535353",
            "535353", "ffffff", "ffffff", "ffffff", "ffffff", "535353",
            "535353", "ffffff", "ffffff", "ffffff", "ffffff", "535353",
            "535353", "ffffff", "ffffff", "ffffff", "ffffff", "535353",
            "535353", "535353", "535353", "535353", "535353", "535353",
        ],
        pattern6: [
            "535353", "535353", "535353", "535353", "535353", "535353", "535353", "535353",
            "535353", "535353", "ffffff", "ffffff", "ffffff", "ffffff", "535353", "535353",
            "535353", "535353", "ffffff", "ffffff", "ffffff", "ffffff", "535353", "535353",
            "535353", "535353", "ffffff", "ffffff", "ffffff", "ffffff", "535353", "535353",
            "535353", "535353", "ffffff", "ffffff", "ffffff", "ffffff", "535353", "535353",
            "535353", "535353", "535353", "535353", "535353", "535353", "535353", "535353",
        ]
    };

    function clearContext() {
        context.interval = null;
    }

    function clearState() {
        context.state.origin = null;
    }

    function lineMatcher(width, data, matches) {
        return width === data
            .filter((e, i) => 
                context.pattern1[((matches) * width) + i] === e || 
                context.pattern2[((matches) * width) + i] === e || 
                context.pattern3[((matches) * width) + i] === e ||
                context.pattern4[((matches) * width) + i] === e || 
                context.pattern5[((matches) * width) + i] === e || 
                context.pattern6[((matches) * width) + i] === e)
            .length
    }

    function scanCapture(capture) {
        let matches = 0;
        for (let y = 0; y < capture.screen.height; y++) {
            const data = [...Array(capture.screen.width)].map((e, x) => (capture.screen.colorAt(x, y)));
            // console.log(JSON.stringify(data));
            if (lineMatcher(capture.screen.width, data, matches)) { matches++ }
            else { matches = 0 }

            if (matches === 0 && lineMatcher(capture.screen.width, data, matches)) { matches++ }
            if (matches === context.pattern1.length / capture.screen.width || matches === context.pattern2.length / capture.screen.width || matches === context.pattern3.length / capture.screen.width) {
                return { top: y - matches,bottom: y }
            }
        }
    }

    const self = () => Object.assign({
        start: _start,
        stop: _stop,
        on: _on
    });

    function _on(e, f) {
        context.emitter.on(e, f);
        
        return self();
    }

    function _start() {
        if (context.start) { return }
        
        context.start = true;
        context.interval = setInterval(async () => {
            if (context.locked) { return }

            context.locked = true;

            // Capture vertical -> for neutral & top
            const vCapture = controller.capture(config.scanner.vertical.position.x, config.scanner.vertical.position.y, config.scanner.vertical.size.width, config.scanner.vertical.size.height);
            const hCapture = controller.capture(config.scanner.horizontal.position.x, config.scanner.horizontal.position.y, config.scanner.horizontal.size.width, config.scanner.horizontal.size.height);
            // const debugCapture = controller.capture(config.scanner.vertical.position.x, config.scanner.vertical.position.y + 50, 100, 150);

            // Capture horizontal -> for bottom
            const vScan = scanCapture(vCapture);
            const hScan = scanCapture(hCapture);
    
            if (hScan) { context.emitter.emit('origin', 0) }
            else if (vScan) { context.emitter.emit('origin', Math.trunc((vCapture.screen.height - vScan.top) / 10)) }

            context.locked = false;
        }, config.frequency);

        return self();
    }

    function _stop() {
        context.start = false;
        clearState();
        clearContext();
    }

    return self();
}