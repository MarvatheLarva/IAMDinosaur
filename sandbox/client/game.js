const EventEmitter = require('events');
const robot = require('robotjs');

const { Gate, Distance } = require('./sensor');

robot.setKeyboardDelay(0);

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

    const gateA = Gate(sensor.gate.a, monitoring)
        .on('activation', async (state) => {   
            monitoring.logger('-> activate GATE A');
            context.buffer.gate.push(state);

            clearTimeout(context.timeout.gameover);
            context.timeout.gameover = setTimeout(() => {
                console.log('GAME OVER');
                monitoring.logger('GAME OVER');
                emitter.emit('gameover', context.score);
            }, 2000);
        })
        .on('scanner', (scan) => {
            context.buffer.scan.push(scan);
        });

    const gateB = Gate(sensor.gate.b, monitoring)
        .on('activation', async (exitState) => {
            monitoring.logger('-> activate GATE B');
        
            const initState = context.buffer.gate.shift();
        
            clearTimeout(context.timeout.gameover);
            context.timeout.gameover = setTimeout(() => {
                // console.log('GAME OVER');
                monitoring.logger('GAME OVER');
                emitter.emit('gameover', context.score);
            }, 2000);

            if (!initState) {
                // console.log('-> error initial state GATE A missing');
                monitoring.logger('{red-fg}-> error initial state GATE A missing{/red-fg}');
                // console.log(exitState);
                // @todo use exitState.position to create fake width, height based on static data
                return;
            }
        
            context.buffer.speed.push((sensor.gate.a.position.x - sensor.gate.b.position.x) / (exitState.activate.in - initState.activate.in));

        });
    
    const distance = Distance(sensor.distance, monitoring);

    const self = () => Object.assign({},{
        start: async (genome) => {
            // click 
            robot.keyTap('up');
            await require('util').promisify(setTimeout)(1000);
            robot.keyTap('up');

            resetContext();

            context.interval.gate.a = gateA.start();

            context.interval.gate.b = gateB.start();

            context.interval.distance = distance((compute) => {
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

            monitoring.logger('GAME START');

            return self();
        },
        stop: () => {

            clearInterval(context.interval.distance);
            context.interval.distance = null;

            clearTimeout(context.timeout.gameover);
            context.timeout.gameover = null;

            gateA.stop();

            gateB.stop();

            monitoring.logger('GAME STOP');

            return self();
        },
        on: (e, func) => {
            emitter.on(e, func);

            return self();
        }
    });

    return self();
}
