require('dotenv').config();

const blessed = require('blessed');
const { exec } = require('child_process');
const sleep = require('util').promisify(setTimeout);

const { Activity, Logger, Stopwatch, BestNetworks, DistanceMetter, Stats, History } = require('./probe');

exports.Terminal = function() {
    const context = {
        state: {
            active: false
        },
        screen: blessed.screen({ fastCSR: true }),
        layoutLeft: blessed.layout({
            bottom: 0,
            parent: context.screen,
            width: Number(process.env.MONITORING_LAYOUT_LEFT),
            height: 30,
            bg: 'green',
            border: { type: 'line', fg: 'white'}
        }),
        layoutRight: blessed.layout({
            right: 0,
            parent: context.screen,
            width: Number(process.env.MONITORING_LAYOUT_RIGHT),
            height: 50,
            bg: 'yellow',
            border: { type: 'line', fg: 'white'}
        })
    }

    // components
    const activity = Activity(context.layoutRight);
    const logger = Logger(context.layoutRight);
    const top10 = BestNetworks(context.layoutRight);
    const history = History(context.layoutRight);
    const stats = Stats(context.layoutLeft);

    const gateStopwatch = Stopwatch(context.layoutLeft, {
        label: 'Gate',
        max: Number(process.env.GATE_STOPWATCH_MAX),
        threshold: Number(process.env.GATE_STOPWATCH_MAX) * 0.7
    });
    
    const distanceStopwatch = Stopwatch(context.layoutLeft, {
        label: 'Distance',
        max: Number(process.env.DISTANCE_STOPWATCH_MAX),
        threshold: Number(process.env.DISTANCE_STOPWATCH_MAX) * 0.7
    });

    const distanceMetter = DistanceMetter(context.layoutLeft, {
        max: Number(process.env.DISTANCE_SIZE_WIDTH)
    });
    
    context.layoutLeft.append(distanceMetter.component)
    context.layoutLeft.append(distanceStopwatch.component);
    context.layoutLeft.append(gateStopwatch.component);
    context.layoutLeft.append(stats.component);

    context.layoutRight.append(activity.component)
    context.layoutRight.append(logger.component);
    context.layoutRight.append(history.component);
    context.layoutRight.append(top10.component);

    context.screen.render();

    context.screen.key('q', async function() {
        exec('yarn stop');
        
        await sleep(2000);

        process.exit(0);
    });

    context.screen.key('s', async function() {
        if (!context.state.active) {
            context.state.active = true;
            context.layoutRight.style.bg = "green";
            activity.update(true);
            
            await sleep(2000);
            
            exec('yarn start');
            
            context.screen.render();
        } else {
            context.state.active = false;
            context.layoutRight.style.bg = "yellow";
            activity.update(false);

            exec('yarn stop');
            
            context.screen.render();
        }
    });

    return {
        update: (probe, data) => {
            switch (probe) {
                case 'stopwatch.gate':
                    gateStopwatch.update(data)
                    break;
                case 'stopwatch.distance':
                    distanceStopwatch.update(data)
                    break;
                case 'distance-metter':
                    distanceMetter.update(data)
                    break;
                case 'logger':
                    logger.update(data)
                    break;
                case 'stats':
                    stats.update(data)
                    history.update(data.lastScore);
                    break;
                case 'top10':
                    top10.update(data)
                    break;
            }
        
          context.screen.render();
        }
    }
}
