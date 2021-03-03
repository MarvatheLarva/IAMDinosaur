require('dotenv').config();

const blessed = require('blessed');
const contrib = require('blessed-contrib');

const { Activity, Logger, Stopwatch, BestNetworks, DistanceMetter, Stats, History } = require('./probe');

exports.Terminal = function() {
    const context = {
        state: {
            active: false
        }
    }

    const screen = blessed.screen({ fastCSR: true });

    const layoutLeft = blessed.layout({
        bottom: 0,
        parent: screen,
        width: Number(process.env.MONITORING_LAYOUT_LEFT),
        height: 30,
        bg: 'green',
        border: { type: 'line', fg: 'white'}
    });

    const layoutRight = blessed.layout({
        right: 0,
        parent: screen,
        width: Number(process.env.MONITORING_LAYOUT_RIGHT),
        height: 50,
        bg: 'yellow',
        border: { type: 'line', fg: 'white'}
    });

    // components
    const activity = Activity(layoutRight);

    const logger = Logger(layoutRight);
    
    const top10 = BestNetworks(layoutRight);

    const history = History(layoutRight);
    
    const gateStopwatch = Stopwatch(layoutLeft, {
        label: 'Gate',
        max: Number(process.env.GATE_STOPWATCH_MAX),
        threshold: Number(process.env.GATE_STOPWATCH_MAX) * 0.7
    });
    
    const distanceStopwatch = Stopwatch(layoutLeft, {
        label: 'Distance',
        max: Number(process.env.DISTANCE_STOPWATCH_MAX),
        threshold: Number(process.env.DISTANCE_STOPWATCH_MAX) * 0.7
    });

    const distanceMetter = DistanceMetter(layoutLeft, {
        max: Number(process.env.DISTANCE_SIZE_WIDTH)
    });
    
    const stats = Stats(layoutLeft);

    layoutLeft.append(distanceMetter.component)
    layoutLeft.append(distanceStopwatch.component);
    layoutLeft.append(gateStopwatch.component);
    layoutLeft.append(stats.component);

    layoutRight.append(activity.component)
    layoutRight.append(logger.component);
    layoutRight.append(history.component);
    layoutRight.append(top10.component);

    screen.render();

    screen.key('q', async function() {
        require('child_process').exec('yarn stop');
        await require('util').promisify(setTimeout)(2000);
        process.exit(0);
    });

    screen.key('s', async function() {
        if (!context.state.active) {
            context.state.active = true;
            layoutRight.style.bg = "green";
            activity.update(true);
            await require('util').promisify(setTimeout)(2000);
            require('child_process').exec('yarn start');
            screen.render();
        } else {
            context.state.active = false;
            layoutRight.style.bg = "yellow";
            activity.update(false);
            require('child_process').exec('yarn stop');
            screen.render();
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
        
          screen.render();
        }
    }
}
