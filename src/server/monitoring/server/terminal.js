const blessed = require('blessed');
const contrib = require('blessed-contrib');

// const { converters } = require("../../utils");
const { PROBE_TYPES } = require('../probe');
const { Time } = require('./components/time');
const { Log } = require('./components/log');

exports.Terminal = () => {
  const state = {
    probes: {},
    components: {},
    screen: blessed.screen({ fastCSR: true, width: 100 })
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
          const layout = blessed.layout({ parent: state.screen, width: state.screen.width, height: 40, top: 10 * Object.keys(state.probes).length, border: { type: 'line', fg: 'white'}});

          if (probe.type === PROBE_TYPES.stopwatch) { state.probes[probe.name] = Time(layout, probe.name, probe.max, probe.threshold) }
          if (probe.type === PROBE_TYPES.log) { state.probes[probe.name] = Log(layout, probe.name) }
        }
        
        if (probe.type === PROBE_TYPES.stopwatch) { state.probes[probe.name](probe.measure) }
        if (probe.type === PROBE_TYPES.log) { state.probes[probe.name](probe.content) }
        
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