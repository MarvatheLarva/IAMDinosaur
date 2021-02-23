const { isMainThread, parentPort } = require('worker_threads');

if (isMainThread) {
  console.error('this file need to be executed inside a worker')
  process.exit()
}

console.log('Inside Worker!', isMainThread);
parentPort.postMessage({foo: 'bar'});

