const { config } = require('./config');
const { Client } = require('./monitoring');
const { Player, Gate, Distance } = require('./sensor');
const { Machine } = require('./machine');
const { Controller } = require('./robot');
const { saveCaptures } = require('./utils');

const sleep = require('util').promisify(setTimeout)

// ######################        Execution          ######################

async function execution(config) {  
    const context = { 
        targets: [],
        results: [],
        captures: {
            gate: [],
            distance: [],
            warning: []
        }
    };
    
    const monitoring = Client(config.monitoring);
    const controller = Controller(config.controller, monitoring);
    const player = Player(config.player, controller, monitoring);
    const gate = Gate(config.gate, controller, monitoring);
    const distance = Distance(config.distance, controller, monitoring);
    const machine = Machine(config.machine, controller, monitoring);

    await sleep(2000);
    
    controller.moveMouse(config.game.position.x, config.game.position.y);
    
    await sleep(100);

    controller.click();
    controller.start();
    
    monitoring.logger('{green-fg}##### GAME START #####{/green-fg}');
    
    machine
        .on('result', (result) => context.results.push(result))
        .start();

    player
        .on('origin', (origin) => machine.update({ player: origin }))
        .start();

    gate
        .on('capture_match', (capture) => !(config.gate.capture) ? null : context.captures.gate.push(capture))
        .on('capture_terminate', (capture) => !(config.gate.capture) ? null : context.captures.gate.push(capture))
        .on('capture_warning', (capture) => context.capture.warning.push(capture))
        .on('terminate', (target) => context.targets.push(target))
        .on('reload', async () => {
            controller.stop();
            gate.stop();
            distance.stop();

            monitoring.logger('{yellow-fg}##### GAME RELOAD #####{/yellow-fg}');
            monitoring.logger('');

            require('fs').writeFileSync(`${__dirname}/../main.logs`, JSON.stringify(context.results));
            await saveCaptures(context.captures.warning, 'WARNING', `${__dirname}/../captures/warning/`, monitoring);
            await saveCaptures(context.captures.gate, 'GATE', `${__dirname}/../captures/gate/`, monitoring);
            await saveCaptures(context.captures.distance, 'DISTANCE', `${__dirname}/../captures/distance/`, monitoring);

            await sleep(3000);

            process.exit(1);
        })
        .start();
    
    distance
        .on('capture', (capture) => !(config.distance.capture) ? null : context.captures.distance.push(capture))
        .on('initialize', (target) => machine.initialize(target) )
        .on('distance', (distance, speed) => machine.play({ distance, speed }) )
        .on('timeout', async () => {
            gate.stop();
            distance.stop();
            machine.stop();

            monitoring.logger('{red-fg}##### GAME OVER #####{/red-fg}');
            monitoring.logger('');

            console.log(context.results);

            require('fs').writeFileSync('../main.logs', JSON.stringify(context.results));
            await saveCaptures(context.captures.warning, 'WARNING', `${__dirname}/../captures/warning/`, monitoring);
            await saveCaptures(context.captures.gate, 'GATE', `${__dirname}/../captures/gate/`, monitoring);
            await saveCaptures(context.captures.distance, 'DISTANCE', `${__dirname}/../captures/distance/`, monitoring);

            await sleep(3000);

            process.exit(1);
        })
        .on('scored', () => {
            machine.scored();
        })
        .start(context.targets);
}

execution(config);

// ######################        /Execution          ######################
