const { EventEmitter } = require('events');

exports.Gate = function (config, controller, monitoring) {
    const context = {
        emitter: new EventEmitter(),
        interval: null,
        state: {
            match: false,
            positions: [],
            activate: { on: null, off: null },
            width: 0,
            locked: false,
            start: false
        }
    };
    
    function clearContext() {
        context.interval = null;
        context.state.match = false;
        context.state.positions = [];
        context.activate = { on: null, off: null };
        context.state.width = 0;
    }
    
    function computeState() {
        context.state.positions.sort((a, b) =>  b-a);
        
        const duration = context.state.activate.off - context.state.activate.on;
        const { width, height, origin } = captureDetails();
        
        return ({ origin, height, width, speed: width/duration });
    }

    function scannerRectangle(capture, size) {
        const matches = { left: null, right: null, top: null, bottom: null};

        // capture width
        for (let xLeft = 0; xLeft < size.width; xLeft++) {
            const xRight = size.width - xLeft - 1;
            for (let y = 0; y < size.height; y++) {
                const [left, right] = [
                    matches.left ? null : config.tracker.colors.includes(capture.colorAt(xLeft, y)), 
                    matches.right ? null : config.tracker.colors.includes(capture.colorAt(xRight, y))
                ];
            
                if (left) { matches.left = xLeft }

                if (right) { matches.right = xRight }

                if (null !== matches.left && null !== matches.right) { break }
            }

            if (null !== matches.left && null !== matches.right) { break }
        }

        // capture height
        for (let yTop = 0; yTop < size.height; yTop++) {
            const yBottom = size.height - yTop  - 1;
            for (let x = 0; x < size.width; x++) {
                const [top, bottom] = [
                    matches.top ? null : config.tracker.colors.includes(capture.colorAt(x, yTop)), 
                    matches.bottom ? null : config.tracker.colors.includes(capture.colorAt(x, yBottom))
                ];
            
                if (top) { matches.top = yTop }

                if (bottom) { matches.bottom = yBottom }

                if (null !== matches.top && null !== matches.bottom) { break }
            }

            if (null !== matches.top && null !== matches.bottom) { break }
        }

        return matches;
    }

    function scannerSquare(capture, size) {
        const matches = { left: null, right: null, top: null, bottom: null};

        // capture width
        for (let x = 0; x < size; x++) {
            const xx = size - x - 1;
            for (let y = 0; y < size; y++) {
                const [left, right, top, bottom] = [
                    matches.left ? null : config.tracker.colors.includes(capture.colorAt(x, y)), 
                    matches.right ? null : config.tracker.colors.includes(capture.colorAt(xx, y)),
                    matches.top ? null : config.tracker.colors.includes(capture.colorAt(y, x)), 
                    matches.bottom ? null : config.tracker.colors.includes(capture.colorAt(y, xx))
                ];
            
                if (left) { matches.left = x }

                if (right) { matches.right = xx }

                if (top) { matches.top = x }

                if (bottom) { matches.bottom = xx }

                if (null !== matches.left && null !== matches.right && null !== matches.top && null !== matches.bottom) { break }
            }

            if (null !== matches.left && null !== matches.right && null !== matches.top && null !== matches.bottom) { break }
        }

        return matches;
    }
    
    function captureDetails() {
        const maxWidth = 110;

        const x = config.position.x - maxWidth;
        const y = config.position.y;

        const capture = controller.capture(x, y, maxWidth, config.size.height);

        context.emitter.emit('capture_terminate', capture);

        const matches = config.scanner.size.height / config.scanner.size.width === 1 ? scannerSquare(capture, config.scanner.size.height) : scannerRectangle(capture, config.scanner.size);

        if ((!matches.top || !matches.bottom || !matches.left || !matches.right)) {
            monitoring.logger(`{red-bg}[GATE] -> [WARNING] missing target ....{/red-bg}`);
            monitoring.logger(`{red-fg}[GATE] -> [WARNING] ${JSON.stringify(matches)}{/red-fg}`);

            emitter.emit('warning', capture);

            console.log('WARNING MISSING TARGET', matches);

            throw new Error();
        }

        const width = matches.right - matches.left;
        const height = matches.bottom - matches.top;
        const origin = config.size.height - matches.bottom - 1;

        if (height > 50 || width > 90) {
            monitoring.logger(`{yellow-bg}[GATE] -> WARNING matches suspect value{/yellow-bg}`);
            emitter.emit('warning', capture);
        }
        
        return { width, height, origin };
    }
    
    function initialize() {
        context.state.match = true;
        context.state.activate.on = Date.now();
        
        monitoring.logger(`[GATE] -> initialize`);
        context.emitter.emit('initialize');
    }
    
    function terminate() {
        context.state.activate.off = Date.now();
        
        monitoring.logger(`[GATE] -> terminate`);
        try {
            context.emitter.emit('terminate', computeState());
        } catch (e) {
            context.emitter.emit('reload');
        }
        clearContext();
    }
    const self = () => Object.assign({}, {
        'start': _start,
        'stop': _stop,
        'on': _on
    });
    
    function _start() {
        context.state.start = true;
        monitoring.logger(`[GATE] -> start`);
        context.interval = setInterval(async () => {
            if (!context.state.start || context.state.locked) return;
            context.state.locked = true;
            await monitoring.stopwatch(config.monitoring.stopwatch, () => {
                const capture = controller.capture(config.position.x, config.position.y, config.size.width, config.size.height);
                const heightCompressed = (config.size.height - 1) / config.compressor;
                const widthCompressed = (config.size.width - 1) / config.compressor;
                const trackers = 2;
                
                let localMatch = false;
                for (let x = 0; x/config.compressor < widthCompressed; x++) {
                    let tolerance = 8;
                    for (let y = 0; y/config.compressor < heightCompressed/trackers; y++) {                       

                        // Used for debug
                        !config.controller.mouse ? null : controller.moveMouse(capture.converters.absolute.x(x), capture.converters.absolute.y(y));
                        !config.controller.mouse ? null : controller.moveMouse(capture.converters.absolute.x(x), capture.converters.absolute.y((config.size.height - 1) - y));

                        const [top, bottom] = [
                            config.tracker.colors.includes(capture.colorAt(x, y)), 
                            config.tracker.colors.includes(capture.colorAt(x, (config.size.height - 1) - y))
                        ];

                        if (top || bottom) { tolerance--; }

                        if (!tolerance) { localMatch = true; break }
                    }
                    if (localMatch) { break }
                }

                
                if (localMatch) context.emitter.emit('capture_match', capture);
                
                if (!context.state.match && localMatch) { return () => initialize() }
                
                if (context.state.match && !localMatch) { return () => terminate() }
            });
            context.state.locked = false;
        }, config.frequency);

        return self();
    }
    
    function _stop() {
        monitoring.logger(`[GATE] -> stop`);
        context.state.start = false;

        clearInterval(context.interval);
        clearContext();

        return self();
    }
    
    function _on(e, func) {
        monitoring.logger(`[GATE] -> register on(${e})`);

        context.emitter.on(e, func);
        
        return self();
    }
    
    return self();
};