require('dotenv').config();

const blessed = require('blessed');
const contrib = require('blessed-contrib');

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
    bg: 'red',
    border: { type: 'line', fg: 'white'}
});

function Logger(layout) {
    const component = blessed.log({ 
        label: ' Logger ',
        width: layout.width - 2,
        height: 34,
        keys: true,
        vi: true,
        mouse: true,
        scrollable: true,
        tags: true,
        fg: "gray",
        selectedFg: "green",
        border: { type: "line", fg: "yellow" },
        scrollback: 1000
    });

    function update(content) {
        component.log(content);
    }

    return {
        component,
        update
    };
}

// options { label: string, max: number, threshold: number }
function Stopwatch(layout, options) {
    const component = contrib.line({
        label: ` Stopwatch / ${options.label} - Maximum [${options.max} ms] - Threshold [${options.threshold} ms] `, 
        width: layout.width - 2,
        height: 8,
        border: { type: 'line', fg: 'white'},
        showNthLabel: 100,
        maxY: options.max,
        showLegend: true, 
        legend: { width: 11, top: 10 }
    });

    const points = [...Array(100).keys()].map(e => 0);

    function setData(measure, values, color) {
        return Object.assign({}, {
            title: `${ measure.toFixed(2) } ms`,
            style: { line: color, text: color },
            x: [...Array(100).keys()].map(e => 'ticks'),
            y: values
        })
    }

    function computeColor(value) {
        const overload = options.max - ((options.max - options.threshold) / 2);
        if (overload < value) {
            return  'red';
        }

        if ((options.threshold) < value) {
            return 'yellow'
        }

        return 'green';
    }

    function update(measure) {
        const color = computeColor(measure);

        component.style.border.fg = color;
        component.style.text = color;

        points.shift();
        points.push(measure);

        component.setData(setData(measure, points, color));
    }
    
    return {
        component,
        update
    }
}

// [["SCORE", "NETWORK_ID", "DATE"], ...]
function BestNetworks(layout) {
    const component = contrib.table({
        label: ' top 10 networks ',
        interactive: false,
        fg: 'white',
        width: layout.width - 2,
        height: 14,
        columnSpacing: 10, 
        columnWidth: [ 12, 38, 20 ],
        border: {type: "line", fg: "blue"},
    });

    function update(networks) {
        component.setData({
            headers: [' score', ' network', ' date'],
            data: networks               
        });
    }

    return {
        component,
        update
    }
}

// options { max: number }
function DistanceMetter(layout, options) {
    const component = contrib.gauge({ 
        label: ' Distance Metter ',
        width: layout.width - 2,
        height: 6,
        border: { type: "line", fg: "yellow" }
    });

    function update(distance) {
        const percent = 100 / (options.max / distance);
        // bug with 1%
        component.setPercent(percent === 1 ? 0 : percent);
    }

    return {
        component,
        update
    }
}

// update data { current: string, lastScore: number, running: string, iteration: number }
function Stats(layout) {
    const component = blessed.text({
        label: ' Stats ',
        fg: 'white',
        width: layout.width - 2,
        height: 6,
        border: {type: "line", fg: "blue"},
    });

    let score = 0;

    function update(data) {
        // console.log(data);
        score = data.lastScore > 0 ? data.lastScore : score;
        component.setContent(`\
current network:    ${ data.current }  \n\
last score:         ${ score }\n\
running:            ${ data.running }\n\
iteration:          ${ data.iterations }\n\
`);
    }

    return {
        component,
        update
    }
}

screen.key('q', async function() {
    require('child_process').exec('yarn stop');
    await require('util').promisify(setTimeout)(2000);
    process.exit(0);
});

screen.key('s', async function() {
    await require('util').promisify(setTimeout)(2000);
    require('child_process').exec('yarn start');
});

// components
const logger = Logger(layoutRight);
const top10 = BestNetworks(layoutRight)
const gateStopwatch = Stopwatch(layoutLeft, { label: 'Gate', max: Number(process.env.GATE_STOPWATCH_MAX), threshold: Number(process.env.GATE_STOPWATCH_MAX) * 0.7 });
const distanceStopwatch = Stopwatch(layoutLeft, { label: 'Distance', max: Number(process.env.DISTANCE_STOPWATCH_MAX), threshold: Number(process.env.DISTANCE_STOPWATCH_MAX) * 0.7 });
const distanceMetter = DistanceMetter(layoutLeft, { max: Number(process.env.DISTANCE_SIZE_WIDTH) });
const stats = Stats(layoutLeft);

layoutLeft.append(distanceMetter.component)
layoutLeft.append(distanceStopwatch.component);
layoutLeft.append(gateStopwatch.component);
layoutLeft.append(stats.component);

layoutRight.append(logger.component);
layoutRight.append(top10.component);

screen.render();

const udp = require('dgram');

const PORT = 2222;

const server = udp.createSocket('udp4');

server
  .on('error', handleError(server))
  .on('message', handleMessage(server))
  .on('close', handleClose(server))
  .bind(PORT);

function handleClose(server) { return () => {
  process.exit();
}}

function handleError(server) { return (error) => {
  console.log('Error: ' + error);
  server.close();
}}

function handleMessage(server) { return (msg, info) => {
    const payload = JSON.parse(msg.toString());
    switch (payload.type) {
        case 'stopwatch.gate':
            gateStopwatch.update(payload.data)
            break;
        case 'stopwatch.distance':
            distanceStopwatch.update(payload.data)
            break;
        case 'distance-metter':
            distanceMetter.update(payload.data)
            break;
        case 'logger':
            logger.update(payload.data)
            break;
        case 'stats':
            stats.update(payload.data)
            break;
        case 'top10':
            top10.update(payload.data)
            break;
    }

  screen.render();
}}
