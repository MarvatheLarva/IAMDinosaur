const blessed = require('blessed');
const { converters } = require("../../utils");
const { Time } = require('./component/time');

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
          const layout = blessed.layout({ parent: state.screen, width: state.screen.width, height: 17, top: 17 * Object.keys(state.probes).length, border: { type: 'line', fg: 'red'}});
          state.probes[probe.name] = Time(layout, probe.name, probe.max, probe.threshold);
        }
        
        state.probes[probe.name](probe.measure);
        
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