const { isMainThread, parentPort, workerData } = require('worker_threads');
const addon = require('../build/Release/robot');

if (isMainThread) {
  console.error('this file need to be executed inside a worker')
  process.exit()
}

((config) => {
  console.log('ADDON', addon);
    // console.log('WORKER')
    // console.log(config);
    // parentPort.postMessage({type: 'data', data: {foo: 'bar'}})
    // parentPort.postMessage({type: 'message', data: {foo: 'bar'}})
    // parentPort.on('toto', (data) => console.log('WORKER', data))
    parentPort.on('message', (message) => {
      console.log('WORKER', message)
    })
})(workerData)

