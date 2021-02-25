const { isMainThread, parentPort, workerData } = require('worker_threads');
const { Monitoring } = require('../monitoring');
const { Capture } = require('../utils');
const robot = require('../../../build/Release/robot');
const { Scanner } = require('./scanner');

if (isMainThread) {
    console.error('this file need to be executed inside a worker');
    process.exit();
}

((config) => {
    const monitoring = Monitoring(config.monitoring.server.address, config.monitoring.server.port);
    monitoring.logger(`GATE ${config.identity} WORKER -> initialize`);

    const context = {
        state: {},
        interval: null
    };

    function initState() {
        context.state.activate =  { in: null, out: null };
        context.state.position =  { x: null, y: null };
        context.state.match = false;
        context.state.toleranced = 0;
    }

    function isActivate() { return !!context.state.activate.in }

    function gateIn(x, y) {
        context.state.activate.in = Date.now();
        context.state.position = { x, y };

        return true;
    }

    function gateOut() {
        if (context.state.activate.in && !context.state.match && context.state.toleranced >= config.tolerance) {
            return !!(context.state.activate.out = Date.now())
        }

        if (context.state.activate.in && !context.state.match) {
            context.state.toleranced++
        }

        return false;
    }

    async function trackPixels() {
        const capture = Capture(config.position.x, config.position.y, config.size.width, config.size.height);
        context.state.match = false;

        const height = Math.trunc((config.size.height - 1) / 3);

        const x = 0;
        for (let yCompressed = height / config.compressor; yCompressed >= 0; yCompressed--) {
            const y = yCompressed * config.compressor;
            const middleY = (height + y) + 1;
            const bottomY = (2 * height + y) + 2;

            const topTracker = new Promise((res) => {
                return res(true === config.tracker.colors.includes(capture.colorAt(x, y)))
            })

            const middleTracker = new Promise((res) => {
                return res(true === config.tracker.colors.includes(capture.colorAt(x, middleY)))
            })

            const bottomTracker = new Promise((res) => {
                return res(true === config.tracker.colors.includes(capture.colorAt(x, bottomY)))
            })

            const [top, bottom, middle] = await Promise.all([topTracker, bottomTracker, middleTracker])

            // robot.moveMouse(capture.converters.absolute.x(x), capture.converters.absolute.y(y));

            if (top || middle || bottom)
                context.state.match = true;

            if (top) {
                if (false === isActivate()) { gateIn(capture.converters.absolute.x(x), capture.converters.absolute.y(y)); }

                break;
            }

            // robot.moveMouse(capture.converters.absolute.x(x), capture.converters.absolute.y(middleY));

            if (middle) {
                if (false === isActivate()) { gateIn(capture.converters.absolute.x(x), capture.converters.absolute.y(middleY)); }

                break;
            }

            // robot.moveMouse(capture.converters.absolute.x(x), capture.converters.absolute.y(bottomY));

            if (bottom) {
                if (false === isActivate()) { gateIn(capture.converters.absolute.x(x), capture.converters.absolute.y(bottomY)); }

                break;
            }
        }

        if (true === gateOut()) { 
            parentPort.postMessage({type: 'activation', data: Object.assign({}, context.state)});
            if (config.scanner) {
                Scanner(config.scanner, monitoring)()
                    .then((data) => {
                        parentPort.postMessage({type: 'scanner', data: Object.assign({}, data)});
                    });
            }
            initState();
        }
    }

    parentPort.on('message', (message) => {
        switch(message.type) {
            case 'start':
                initState();
        
                context.interval = setInterval(() => {
                    monitoring.stopwatch(config.identity, config.monitoring.stopwatch, trackPixels);
                }, config.frequency);
                break;
            case 'stop':
                clearInterval(context.interval);
                break;
        }
    });

})(workerData)
