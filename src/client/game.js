const EventEmitter = require('events');
const robot = require('robotjs');

const { Gate, Distance, Scanner, Status } = require('./sensor');

exports.Game = (sensor, monitoring) => {
    const emitter = new EventEmitter();
    const context = {
        score: 0,
        current: null,
        passthrough: false,
        buffer: { gate: [], scan: [], speed: [] },
        timeout: {
            gameover: null
        },
        interval: {
            status: null,
            gate: { a: null, b: null },
            distance: null
        }
    };

    function resetContext() {
        context.score = 0;
        context.current = null;
        context.buffer.gate = [];
        context.buffer.scan = [];
        context.buffer.speed = [];
    }

    const self = () => Object.assign({},{
        start: (genome) => {
            resetContext();

            const scanner = Scanner(sensor.scanner, monitoring);

            context.interval.gate.a = Gate(sensor.gate.a, monitoring)
                .on('activation', async (state) => {   
                    monitoring.logger('-> activate GATE A');
                    
                    context.buffer.scan.push(await scanner());
                    context.buffer.gate.push(state);

                    clearTimeout(context.timeout.gameover);
                    context.timeout.gameover = setTimeout(() => {
                        console.log('GAME OVER');
                        emitter.emit('gameover', context.score);
                    }, 2000);
                })
                .start();

            context.interval.gate.b = Gate(sensor.gate.b, monitoring)
                .on('activation', async (exitState) => {
                    monitoring.logger('-> activate GATE B');
                
                    const initState = context.buffer.gate.shift();
                
                    if (!initState) { monitoring.logger('{red-fg}-> error initial state GATE A missing{/red-fg}'); return;}
                
                    context.buffer.speed.push((sensor.gate.a.position.x - sensor.gate.b.position.x) / (exitState.activate.on - initState.activate.on));
                })
                .start();

            context.interval.distance = Distance(sensor.distance, monitoring)((compute) => {
                if (!context.current && (!context.buffer.scan.length || !context.buffer.speed.length)) return;
                
                if (!context.current) {
                    const scan = context.buffer.scan.shift();
                    const speed = context.buffer.speed.shift()
                    context.current = Object.assign({}, {speed, origin: scan.origin / 100, width: scan.width / 100, height: scan.height / 100});

                    monitoring.logger(`-> Init Distance metter`);
                    monitoring.logger(`{yellow-fg}${JSON.stringify(context.current, null, 0)}{/yellow-fg}`);
                }
                
                const distance = compute(context.current);

                genome(Object.assign({}, context.current, { distance: distance / 220 }));
            
                if (!context.passthrough && 0 === distance) {
                    context.passthrough = true;
                };
            
                if (context.passthrough && distance > 0) {
                    context.passthrough = false;
                    context.current = null;
                    context.score++;
                }
            });

            // click 
            robot.keyTap('up')

            return self();
        },
        stop: () => {
            clearInterval(context.interval.status);
            context.interval.status = null;

            clearInterval(context.interval.distance);
            context.interval.distance = null;

            clearInterval(context.interval.gate.a);
            context.interval.gate.a = null;

            clearInterval(context.interval.gate.b);
            context.interval.gate.b = null;

            return self();
        },
        on: (e, func) => {
            emitter.on(e, func);

            return self();
        }
    });

    return self();
}
