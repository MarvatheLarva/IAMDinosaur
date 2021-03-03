const udp = require('dgram');

const { converters } = require('../utils');
const { PROBE } = require('./probe');

exports.Client = function (config) {
    const context = {
        state: {
            stopwatches: {}
        },
        client: ((client, address, port) => (data) => {
            const buffer = Buffer.from(JSON.stringify(data));
    
            client.send(buffer, port, address)
        })(udp.createSocket('udp4'), config.address, config.port)
    }

    function logger(content) {
        context.client({ probe: PROBE.logger, data:content });
    }

    async function stopwatch(config, func) {
        const start = process.hrtime.bigint();
        await func();
        const end = process.hrtime.bigint();

        if (!config.active) { return }

        if (!context.state.stopwatches[config.probe]) { context.state.stopwatches[config.probe] = [] }

        context.state.stopwatches[config.probe].push(converters.milliseconds(Number(end - start)));

        if (context.state.stopwatches[config.probe].length >= 100) {
            const average = context.state.stopwatches[config.probe].splice(0, 100).reduce((a, b) => a + b);
            context.client({ probe: config.probe, data: average/100 })
        }
    }

    function distanceMetter(distance,  config) {
        if (config.active) { context.client({ probe: PROBE.distanceMetter, data:distance }) }
    }

    function stats(data) {
        context.client({ probe: PROBE.stats, data })
    }

    function top10(data) {
        context.client({ probe: PROBE.top10, data })
    }
    
    return { logger, stopwatch, distanceMetter, stats, top10 };
}