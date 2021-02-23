const udp = require('dgram');

const TYPES = {
    stopwatch: 'stopwatch',
    logger: 'logger'
};

exports.Monitoring = (address, port) => {
    
    const monitoringClient = ((client, address, port) => (data) => {
        const buffer = Buffer.from(JSON.stringify(data));

        client.send(buffer, port, address)
    })(udp.createSocket('udp4'), address, port);

    return {
        logger: ((client) => (content, channel = 'main') => {
            // console.log(content);
            client({ type: TYPES.logger, name: channel, content })
        })(monitoringClient),
        stopwatch: ((client) => async (name, config, func) => {
            const start = process.hrtime.bigint();
    
            const data = await func();

            const end = process.hrtime.bigint();

            const measure = Number(end - start); // nano seconds

            if (!config.mute)
                client({ type: TYPES.stopwatch, name, measure, max: config.max, threshold: config.threshold });

            return data;
        })(monitoringClient)
    };
}