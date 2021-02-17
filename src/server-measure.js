const udp = require('dgram');
const blessed = require('blessed');

const PORT = 2222;

const progressBarConfig = {
  border: 'line',
  style: {
    fg: 'blue',
    bg: 'default',
    bar: {
      bg: 'default',
      fg: 'blue'
    },
    border: {
      fg: 'default',
      bg: 'default'
    }
  },
  ch: ':',
  orientation: 'vertical',
  top: 0,
  width: 3,
  height: 10,
  filled: 0,
}

const server = udp.createSocket('udp4');
const ui = Ui();
server
  .on('error', handleError(server))
  .on('message',handleMessage(server, ui))
  .on('listening', handleListening(server, ui))
  .on('close', handleClose(server))
  .bind(PORT);

function handleClose(server) { return () => {
  process.exit();
}}

function handleError(server) { return (error) => {
  console.log('Error: ' + error);
  server.close();
}}

function handleMessage(server, ui) { return (msg, info) => {
  ui.addProbe(JSON.parse(msg.toString()))
}}

function handleListening(server, ui) { return () => {
  const address = server.address();
  const state = { count: 0 };

  ui.init(server);
}}

function component(parent, index) {
    const height = 12;
    const state = {
      title: blessed.text({ left: 0, top: 11 + index * height, parent, content: ''}),
      progress: blessed.ProgressBar(Object.assign({}, progressBarConfig, { left: 1, top: 1 + index * height, parent })),
      time: blessed.text({ left: 10, top: 11 + index * height, parent, content: ''}),
      graph: [],
      graphLayout: blessed.layout({ left: 5, top: 0 + index * height, height: 11, width: 50, parent, bg: 'green', border: { type: 'line', fg: 'red'}}),
      graphBox: [
        // left
        // blessed.line({left: 5, height: 11, style: {fg: 'red'}, parent, orientation: 'vertical' }),
        // bottom
        // blessed.line({left: 5, top: 11, width: 100, style: {fg: 'red'}, parent, orientation: 'horizontal' })
      ]
    }

    return state;
  }

function Ui() {
  const state = {
    probes: {},
    components: {},
    screen: blessed.screen({ fastCSR: true })
  }

  state.screen.key('q', function() {
    process.exit(0);
  });

  function render() {
    state.screen.render();
  }

  const self = () =>  {
    return {
      addProbe: (probe) => {
        if (!Object.keys(state.probes).filter(name => name === probe.name).length) {
          state.probes[probe.name] = [];
          state.components[probe.name] = component(state.screen, Object.keys(state.components).length);
        }

        state.probes[probe.name].push(probe);

        state.components[probe.name].time.setContent(`${probe.measure / 1000000}ms`);
        state.components[probe.name].title.setContent(`${probe.name}`);
                
        const height = 10 - Math.trunc(Math.min(Math.max(Math.trunc(probe.measure / 1000000), 0), 10));

        state.components[probe.name].progress.setProgress((10 - height) * 10);

        const top = Math.trunc(10 - height);

        state.components[probe.name].graph.push(blessed.line({ height: height, parent: state.components[probe.name].graphLayout, orientation: 'vertical' }))

        const indexGarbage = state.components[probe.name].graph.length - 48;
        state.components[probe.name].graph = state.components[probe.name].graph.filter((e, i) => {
          if (i < indexGarbage) {
            e.detach();
            return false;
          }

          return true;
        })
        
        render();

        return self();
      },
      init: (server) => {
        const address = server.address();

        state.screen.title = `Server measure ://${address.address}:${address.port}`;
        
        render();
      }
    }
  }

  return self();
}