const { EventEmitter } = require('events');

exports.Distance = function(config, controller, monitoring) {
    const context = {
        emitter: new EventEmitter(),
        interval: null,
        timeout: null,
        locked: false,
        state: {
            targets: null,
            current: null,
            distance: null,
            passthrough: false,
        }
    };

    function clearContext() {
        clearTimeout(context.timeout);
        clearInterval(context.interval);

        context.interval = null;
        context.timeout = null;
        context.locked = false;
        context.start = false;
    }

    function clearState() {
        context.state.targets = null;
        context.state.current = null;
        context.state.distance = null;
        context.state.passthrough = false;
    }

    function parseCapture(capture) {
        for (let yCompressed = 0; yCompressed < config.size.height / config.compressor; yCompressed++) {
            const y = yCompressed * config.compressor;
            for (let xCompressed = 0; xCompressed < config.size.width / config.compressor; xCompressed++) {
                const x = xCompressed * config.compressor;
            
                if (config.tracker.colors.includes(capture.colorAt(x, 0))) {
                    // Used for debug
                    !config.controller.mouse ? null : controller.moveMouse(capture.converters.absolute.x(x), capture.converters.absolute.y(y));

                    return x;
                }
            }
        }

        return config.size.width;
    }

    function initTimeout() {
        clearTimeout(context.timeout);
        context.timeout = setTimeout(() => {
            monitoring.logger(`[DISTANCE] -> timeout`);
            if (context.start) { context.emitter.emit('timeout') }
        }, config.timeout);
    }

    const self = () => Object.assign({}, {
        'start': _start,
        'stop': _stop,
        'on': _on
    });

    function _start(targets) {
        if (context.start) { return }
        context.start = true;

        monitoring.logger(`[DISTANCE] -> start`);
        
        context.state.targets = targets;
        context.interval = setInterval(async () => {
            if (context.locked) { return }

            context.locked = true;
            await monitoring.stopwatch(config.monitoring.stopwatch, () => {
                if (!context.state.current && (!context.state.targets.length)) { return }
                
                if (!context.state.current) {
                    context.state.current = context.state.targets.shift();

                    monitoring.logger(`[DISTANCE] -> initialize`);

                    initTimeout();

                    return context.emitter.emit('initialize', context.state.current);
                }
                
                const capture = controller.capture(config.position.x, config.position.y - (context.state.current.height / 2 + context.state.current.origin) - (config.size.height * 4), config.size.width, config.size.height);
                
                context.emitter.emit('capture', capture);

                const distance = parseCapture(capture);
                if (distance === context.state.distance) { return }
                
                context.state.distance = distance;
                
                monitoring.distanceMetter(context.state.distance, config.monitoring.distanceMetter);
                
                if (!context.state.passthrough && 40 > context.state.distance) {
                    context.state.passthrough = true ;
                    
                    return context.emitter.emit('distance', context.state.distance);
                } else if (context.state.passthrough && context.state.distance > 50) {
                    context.state.passthrough = false;
                    context.state.current = null;
                    
                    monitoring.logger('[DISTANCE] -> scored');
                    
                    return context.emitter.emit('scored');
                } else if (!context.state.passthrough) {
                    if (context.state.distance > 260) { return }
                    
                    return context.emitter.emit('distance', context.state.distance);
                }
            });
            context.locked = false;
        }, config.frequency);

        return self();
    }

    function _stop() {
        context.start = false;

        clearContext();
        clearState();

        monitoring.logger(`[DISTANCE] -> stop`);

        return self();
    }

    function _on(e, func) {
        monitoring.logger(`[DISTANCE] -> register on(${e})`);
        context.emitter.on(e, func);

        return self();
    }

    return self();
};