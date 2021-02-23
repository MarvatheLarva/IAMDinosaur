const { isMainThread, parentPort } = require('worker_threads');
const { Monitoring } = require('iamdino/client/monitoring');

if (isMainThread) {
    console.error('this file need to be executed inside a worker')
    process.exit()
  }

