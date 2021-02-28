const { Worker } = require('worker_threads');
const { EventEmitter } = require('events');

exports.Gate = (config, monitoring) => {
    monitoring.logger(`GATE ${config.identity} -> initialize`);

    const emitter = new EventEmitter();

    const worker = new Worker(__filename.replace('.js', '.worker.js'), { workerData: Object.assign({}, config) });
    worker.on('message', (message) => {
        switch (message.type) {
            case 'activation':
                monitoring.logger(`GATE ${config.identity} -> activation`);

                emitter.emit('activation', message.data);
                break;
            case 'scanner':
                monitoring.logger(`GATE ${config.identity} -> scanner`);

                emitter.emit('scanner', message.data);
                break;
        }
    });

    const self = () => Object.assign({}, {
        on: (e, func) => {
            emitter.on(e, func);

            return self();
        },
        start: () => {
            return worker.postMessage({type: 'start'});
        },
        stop: () => {
            return worker.postMessage({type: 'stop'});
        },
    });

    return self();
}
