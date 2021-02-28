const blessed = require('blessed');
const contrib = require('blessed-contrib');
const {green}=require('colors');

exports.Log = (layout, name) => {
    const distance = contrib.gauge({ 
        label: name,
        width: layout.width - 2,
        height: layout.height - 2,
        stroke: 'green',
        fill: 'white',
        border: { type: "line", fg: "cyan" }});

    layout.append(distance);

    return (content) => {
        distance.setPercent(content);
    }
}
