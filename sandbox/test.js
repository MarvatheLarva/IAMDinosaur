const { Worker } = require('worker_threads');

exports.test = ()  => {
    const worker = new Worker(__filename.replace('.js', '.worker.js'), { workerData: { foo: 'bar' } });
    worker.on('message', (message) => console.log('MAIN', message))
    worker.postMessage('TEST')
    worker.postMessage('tata')
}
