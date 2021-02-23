const { EventEmitter } = require('events');
const robot = require('robotjs');

const STATUS_INIT = 0;
const STATUS_RUNNING = 1;
const STATUS_GAMEOVER = 2;

exports.Status = (config, monitoring) => {
    const emitter = new EventEmitter();
    const context = {
        status: null,
    };

    const self = () => Object.assign({}, {
        start: () => {
            function fingerPrint(positions, tracker) {
                return new Promise(resolve => {
                    const resultats = positions.map(position => {
                        return tracker.colors.includes(robot.getPixelColor(position.x, position.y));
                    })

                    resolve(!(!!resultats.filter(e => !e).length));
                })
            }

            return setInterval(async () => {
                monitoring.stopwatch(config.identity, config.monitoring.stopwatch, async () => {
                    const [ init, running, gameover ] = await Promise.all([
                        fingerPrint(config.positions.init.positions, config.positions.init.tracker),
                        fingerPrint(config.positions.running.positions, config.positions.running.tracker),
                        fingerPrint(config.positions.gameover.positions, config.positions.gameover.tracker)
                    ]);

                    if (init) {
                        if (context.status === STATUS_INIT) return;

                        context.status = STATUS_INIT;
                        emitter.emit('update', 'init');
                    } else if (running) {
                        if (context.status === STATUS_RUNNING) return;

                        context.status = STATUS_RUNNING;
                        emitter.emit('update', 'running');
                    } else if (gameover) {
                        if (context.status === STATUS_GAMEOVER) return;

                        context.status = STATUS_GAMEOVER;
                        emitter.emit('update', 'gameover');
                    }
                });
            }, config.frequency);
        },
        on: (e, func) => { 
            emitter.on(e, func);

            return self();
        }
    });

    return self();
}
