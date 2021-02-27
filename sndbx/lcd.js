const blessed = require('blessed');
const contrib = require('blessed-contrib');

const screen = blessed.screen({ fastCSR: true, width: 200 });

var table = contrib.table(
    {
    fg: 'white'
    , selectedFg: 'white'
    , selectedBg: 'blue'
    , label: 'Best genomes'
    , width: 100
    , height: 10
    , border: {type: "line", fg: "cyan"}
    , columnSpacing: 10 //in chars
    , columnWidth: [38, 12, 12] /*in chars*/
})

  table.setData(
  { headers: [' id', ' score']
  , data:
     [ ['52d7b39e-5f5b-4a7a-8a55-9ae31351371a', '201120']
     , ['52d7b39e-5f5b-4a7a-8a55-9ae31351371a', '53000'] ]})
    
    
screen.append(table);

// const distance = contrib.gauge({ 
//     label: 'Distance',
//     width: 100,
//     height: 6,
//     // stroke: 'green',
//     // fill: 'red',
//     border: { type: "line", fg: "cyan" }});

//     screen.append(distance)
    
//     distance.setPercent(10);
    // distance.options.stroke = 'blue';

screen.render();