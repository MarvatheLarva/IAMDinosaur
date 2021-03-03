const udp = require('dgram');
const {probe}=require('../../sandbox/server/monitoring/probe');

const { converters } = require('../utils');
const { PROBE } = require('./probe');

exports.Client = function (config) {
    const context = {
        state: {
            stopwatches: {}
        }
    }
    
    const monitoringClient = ((client, address, port) => (data) => {
        const buffer = Buffer.from(JSON.stringify(data));

        client.send(buffer, port, address)
    })(udp.createSocket('udp4'), config.address, config.port);

    const self = () => Object.assign({}, {
        logger: ((client) => (content) => {
            client({ probe: PROBE.logger, data:content });
        })(monitoringClient),
        
        stopwatch: ((client) => async (config, func) => {
            const start = process.hrtime.bigint();
    
            const resolve = await func();

            const end = process.hrtime.bigint();
            
            if (resolve) { resolve() }

            if (config.active && !context.state.stopwatches[config.probe]) {
                context.state.stopwatches[config.probe] = [];
            }

            if (config.active) {
                context.state.stopwatches[config.probe].push(converters.milliseconds(Number(end - start)));
            }

            if (config.active && context.state.stopwatches[config.probe].length >= 100) {
                let average = 0;
                context.state.stopwatches[config.probe].splice(0, 100).map(e => average += e);
                client({ probe: config.probe, data: average/100})
            }

        })(monitoringClient),
        distanceMetter: ((client) => (distance,  config) => {
            if (config.active) { client({ probe: PROBE.distanceMetter, data:distance }) }
        })(monitoringClient),

        // { current: string, lastScore: number, running: string, generations: number }
        stats: ((client) => (data) => {
            client({ probe: PROBE.stats, data })
        })(monitoringClient),
        
        // [["SCORE", "NETWORK_ID", "DATE"], ...]
        top10: ((client) => (data) => {
            client({ probe: PROBE.top10, data })
        })(monitoringClient)
    })

    return self();
}