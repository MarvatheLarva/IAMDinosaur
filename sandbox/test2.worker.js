const { isMainThread, parentPort, workerData } = require('worker_threads');
const addon = require('../build/Release/robot');

if (isMainThread) {
  console.error('this file need to be executed inside a worker')
  process.exit()
}
console.log(addon);

((config) => {
    // robot.moveMouse(10, 100);
    // robot.screen.capture(0, 0, 10, 10);
    // console.log('WORKER')
    // console.log(config);
    // parentPort.postMessage({type: 'data', data: {foo: 'bar'}})
    // parentPort.postMessage({type: 'message', data: {foo: 'bar'}})
    // parentPort.on('toto', (data) => console.log('WORKER', data))
    parentPort.on('message', (message) => {
      console.log('WORKER', message)
    })
})(workerData)

