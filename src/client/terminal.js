const EventEmitter = require('events');
const readline = require('readline');

exports.Terminal = (func) => {
    const emitter = new EventEmitter();
    const context = func();

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);

    process.stdin.on('keypress', ((args) => (str, key) => { 
        if (key.name === 'q') emitter.emit('quit', ...args)
        if (key.name === 's') emitter.emit('start', ...args)
    })(context))

    return emitter;
}