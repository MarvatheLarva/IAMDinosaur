const blessed = require('blessed');
const contrib = require('blessed-contrib');
const { converters } = require('../../../utils');

exports.Time = (layout, name, max, threshold, color = 'green') => {
    const state = { name, max, threshold, color, maxY: max }

    const line = contrib.line({
        label: ` ${ state.name } - Frequency ${ converters.milliseconds(state.max).toFixed(2) } ms - Threshold ${ converters.milliseconds(state.threshold).toFixed(2) } ms `, 
        height: 15,
        width: layout.width - 2,
        top: 1,
        left: 1,
        border: { type: 'line', fg: 'white'},
        showNthLabel: 100,
        maxY: converters.milliseconds(state.maxY),
        showLegend: true, 
        legend: { width: 10 }
    })

    layout.append(line);

    const points = [...Array(100).keys()].map(e => 0);

    function setData(measure, values, color) {
        return Object.assign({}, {
            title: `${ measure.toFixed(2) } ms`,
            style: { line: color, text: color },
            x: [...Array(100).keys()].map(e => ' '),
            y: values
        })
    }

    line.setData(setData(0, points, 'green'));

    function computeColor(value) {
        const overload = converters.milliseconds(state.max) - (converters.milliseconds(state.max) - converters.milliseconds(state.threshold)) / 2;
        if (overload < value) {
            return  'red';
        }

        if (converters.milliseconds(state.threshold) < value) {
            return 'yellow'
        }

        return 'green';
    }

    return (measure) => {
        const value = converters.milliseconds((state.maxY * measure ) / state.max);
        const color = computeColor(value);

        layout.style.border.fg = color;
        line.style.border.fg = color;
        line.style.text = color;

        points.shift();
        points.push(value);

        line.setData(setData(converters.milliseconds(measure), points, color));
        // layout.render();
    }
}
