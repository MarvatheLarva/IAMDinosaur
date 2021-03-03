const blessed = require('blessed');
const contrib = require('blessed-contrib');

exports.PROBE = {
    stopwatch: { gate: 'stopwatch.gate', distance: 'stopwatch.distance'},
    logger: 'logger',
    distanceMetter: 'distance-metter',
    stats: 'stats',
    top10: 'top10'
};

exports.Activity = function Activity(layout) {
    const component = blessed.element({
        width: 10,
        height: 1,
        right: 0,
        content: 'INACTIVE'
    });

    function update(data) {
        component.setText(data ? 'ACTIVE' : 'INACTIVE');
        component.render();
    }

    return {
        component,
        update
    }
}

exports.Logger = function Logger(layout) {
    const component = blessed.log({ 
        label: ' Logger ',
        width: layout.width - 2,
        height: 18,
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
exports.Stopwatch = function Stopwatch(layout, options) {
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
        
        if (overload < value) { return  'red' }
        if ((options.threshold) < value) { return 'yellow' }

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
exports.BestNetworks = function BestNetworks(layout) {
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
exports.DistanceMetter = function DistanceMetter(layout, options) {
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
exports.Stats = function Stats(layout) {
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

exports.History = function History(layout, options) {
    const context = {
        state: {
            round: 0,
            score: 0
        }
    };

    const component = contrib.line({
        label: ` History `, 
        width: layout.width - 2,
        height: 15,
        border: { type: 'line', fg: 'blue'},
        showNthLabel: 12,
        // maxY: 1000,
        showLegend: false, 
        //legend: { width: 20 }
    });

    const scores = [];
    const iterations = [];

    function setData(score, values, color) {
        return Object.assign({}, {
            title: score,
            style: { line: color, text: color },
            x: [...scores.keys()].map(e => 'iteration'),
            y: values
        })
    }

    function update(score) {
        if (score === undefined) { return }
        context.state.round++;
        if (scores.length > 1200)
            scores.shift();
        scores.push(score);

        if (context.state.round && context.state.round % 12 === 0) {
            const scoreIteration = scores.slice(-12).sort((a, b) => b - a)[0];
            if (iterations.length > 1200)
                iterations.shift();
            iterations.push(scoreIteration)
            context.state.score = scoreIteration;
        } else { iterations.push(context.state.score) }
        
        component.setData([
            setData(`current ${score}`, scores, 'white'),
            setData(`best ${context.state.score}`, iterations, 'green')
        ]);
    }
    
    return {
        component,
        update
    }
}