const { EventEmitter } = require('events');

exports.Distance = function(config, controller, monitoring) {
    const context = {
        emitter: new EventEmitter(),
        interval: null,
        timeout: null,
        locked: false,
        targets: null,
        state: {
            current: null,
            distance: null,
            speed: null
        }
    };

    function clearContext() {
        clearTimeout(context.timeout);
        clearInterval(context.interval);

        context.interval = null;
        context.timeout = null;
        context.locked = false;
        context.start = false;
        context.targets = null;
    }

    function clearState() {
        context.state.current = null;
        context.state.distance = null;
        context.state.speed = null;
    }

    function parseCapture(capture) {
        for (let yCompressed = 0; yCompressed < config.size.height / config.compressor; yCompressed++) {
            const y = yCompressed * config.compressor;
            for (let xCompressed = 0; xCompressed < config.size.width / config.compressor; xCompressed++) {
                const x = xCompressed * config.compressor;
            
                if (config.tracker.colors.includes(capture.colorAt(x, 0))) {
                    !config.controller.mouse ? null : controller.moveMouse(capture.converters.absolute.x(x), capture.converters.absolute.y(y));
                    // Used for debug

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
        
        context.targets = targets;
        context.interval = setInterval(async () => {
            if (context.locked) { return }

            context.locked = true;
            await monitoring.stopwatch(config.monitoring.stopwatch, () => {
                
                if (!context.state.current && (!context.targets.length)) { return context.emitter.emit('distance', config.size.width, context.state.speed); }
                
                if (!context.state.current) {
                    context.state.current = context.targets.shift();

                    monitoring.logger(`[DISTANCE] -> initialize`);

                    initTimeout();

                    context.emitter.emit('initialize', context.state.current);
                }
                
                const capture = controller.capture(config.position.x, config.position.y - (context.state.current.height / 2 + context.state.current.origin) - (config.size.height * 4) - 2, config.size.width, config.size.height);
                
                context.emitter.emit('capture', capture);

                const distance = parseCapture(capture);
                
                if (null !== context.state.distance && distance > context.state.distance + 20) {
                    clearState();
                    
                    // console.log('EXIT PASSTHROUGH', distance);
                    
                    context.emitter.emit('scored');

                    // if (context.targets.length) {
                    //     context.state.current = context.targets.shift();
    
                    //     initTimeout();
                    // }

                    // context.emitter.emit('initialize', context.state.current);
                }

                // TO REFACTOR
                const averageSpeed = context.state.distance - distance;
                if (distance > 10 && averageSpeed > 0 && (context.state.speed === null || (null !== context.state.speed && (averageSpeed === context.state.speed || context.state.speed > 1.2 * averageSpeed )) )) {
                    context.state.speed = Math.max(averageSpeed, 4);
                }
                
                context.state.distance = distance;
                
                monitoring.distanceMetter(context.state.distance, config.monitoring.distanceMetter);
                
                if (null === context.state.speed || context.state.distance < 20) { return }
                
                context.emitter.emit('distance', context.state.distance, context.state.speed);
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