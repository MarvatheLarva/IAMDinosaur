const { Worker } = require('worker_threads');

let foo = null;

function test() {
    foo = () => console.log('ALLO');    
    console.log(__filename);
    // This re-loads the current file inside a Worker instance.
    const worker = new Worker(__filename.replace('.js', '.worker.js'));
    console.log('Main worker', foo);
    worker.once('message', (message) => {
    console.log(message);  // Prints 'Hello, world!'.
    });
}

test();