const blessed = require('blessed');
const contrib = require('blessed-contrib');
// const colors = require('colors/safe');

// const screen = blessed.screen({ fastCSR: true, width: 100 });
// const layout = blessed.layout({ parent: screen, width: screen.width, height: 17, border: { type: 'line', fg: 'red'}});

exports.Time = (layout, name, max, threshold) => {
    const state = { name, max, threshold }
    
    const line = contrib.line({
        label: ` ${ state.name } - Max ${ state.max } ms - Threshold ${ state.threshold } ms `, 
        height: 15,
        width: layout.width - 2,
        top: 1,
        left: 1,
        border: { type: 'line', fg: 'white'},
        showNthLabel: 100,
        maxY: 100,
        showLegend: true, 
        legend: { width: 10 }
    })

    layout.append(line);

    const points = [...Array(100).keys()].map(e => 0);

    function setData(measure, values, color) => Object.assign({}, {
        title: `${ measure } ms`,
        style: { line: color, text: color },
        x: [...Array(100).keys()].map(e => ' '),
        y: values
    })

    line.setData(setData(0, points, 'green'));

    computeColor(measure) {

    }

    return (measure) => {
        const color = 'green';
        
        points.shift();
        points.push(measure);

        line.setData(setData(0, points, color));
    }
}



// screen.key('q', function() {
//     process.exit(0);
// });

// screen.render();




// // Allright
// setTimeout(() => {

//     layout.style.border.fg = 'green';
//     transactionsData.style.line = 'green';

//     line.style.border.fg = 'green';
//     line.style.text = 'green';

//     line.setData(transactionsData);

//     screen.render();
// }, 2000);

// // Warning
// setTimeout(() => {
//     layout.style.border.fg = [255, 165, 0, 1];

//     transactionsData.style.line = 'yellow';

//     line.style.border.fg = [255, 165, 0, 1];
//     line.style.text = [255, 165, 0, 1];

//     line.setData(transactionsData);
    
//     screen.render();
// }, 4000);

// // Overload
// setTimeout(() => {
//     layout.style.border.fg = 'red';

//     transactionsData.style.line = 'red';

//     line.style.text = 'red';
//     line.style.border.fg = 'red';

//     line.setData(transactionsData);

//     screen.render();
// }, 6000);
