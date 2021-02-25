const blessed = require('blessed');
const contrib = require('blessed-contrib');
const { converters } = require('../../../../utils');

exports.Log = (layout, name) => {
    const state = { name }

    const logger = blessed.log({ 
        keys: true,
        vi: true,
        mouse: true,
        // alwaysScroll:true,
        scrollable: true,
        tags: true,
        label: name, width: layout.width - 2,height: 8, fg: "green", selectedFg: "green", border: {type: "line", fg: "cyan"}});

    layout.append(logger);

    // const logs = [];

    // function setData(measure, values, color) {
    //     return Object.assign({}, {
    //         title: `${ measure.toFixed(2) } ms`,
    //         style: { line: color, text: color },
    //         x: [...Array(100).keys()].map(e => ' '),
    //         y: values
    //     })
    // }

    // line.setData(setData(0, points, 'green'));

    // function computeColor(value) {
    //     const overload = converters.milliseconds(state.max) - (converters.milliseconds(state.max) - converters.milliseconds(state.threshold)) / 2;
    //     if (overload < value) {
    //         return  'red';
    //     }

    //     if (converters.milliseconds(state.threshold) < value) {
    //         return 'yellow'
    //     }

    //     return 'green';
    // }

    return (content) => {
        // const value = converters.milliseconds((state.maxY * measure ) / state.max);
        // const color = computeColor(value);

        // layout.style.border.fg = color;
        // line.style.border.fg = color;
        // line.style.text = color;

        // points.shift();
        logger.log(content);

        // line.setData(setData(converters.milliseconds(measure), points, color));
        // layout.render();
    }
}
