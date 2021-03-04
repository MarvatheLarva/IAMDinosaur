
const { Networks } = require('./networks');

exports.Machine = function (config, controller, monitoring) {
    const networks = Networks(config.network, monitoring);

    const context = {
        network: null,
        location: null,
        start: false,
        state: {
            on: null,
            off: null,
            score: 0,
            inputs: {
                width: null,
                height: null,
                speed: null,
                origin: null,
                distance: null
            }
        }
    };

    function clearContext() {
        context.network = null;
        context.location = null;
        context.state.score = 0;
        context.state.on = null;
        context.state.off = null;
        context.state.inputs = {
            width: null,
            height: null,
            speed: null,
            origin: null,
            distance: null
        };
    }

    function computeInputs(rawInputs) {
        Object.keys(rawInputs).map(k => {
            context.state.inputs[k] = rawInputs[k] / config.inputs.max[k];
        })
    }

    function monitore(score) {
        const processStats = networks.process.stats();
        const legacyStats =  networks.legacy.stats();

        monitoring.stats({ 
            current: processStats.current, 
            lastScore: score, 
            running: `${processStats.running}/${config.network.generations}`, 
            iterations: legacyStats.iterations
        });
        monitoring.top10(legacyStats.top10);
    }

    const self = () => Object.assign({}, {
        'start': _start,
        'stop': _stop,
        'initialize': _initialize,
        'play': _play,
        'scored': _scored
    });

    function _start() {
        monitoring.logger(`[MACHINE] -> start`);

        if (context.start) { return }

        context.start = true;

        if (networks.process.isEmpty()) { networks.process.initialize() }

        monitore()

        const data = networks.process.pick();

        context.network = data.network;
        context.location = data.location;
        context.state.on = Date.now();
    }

    function _stop() {
        context.start = false;
        context.state.off = Date.now();
        // context.state.score = Math.trunc(Math.max(0, (context.state.off - context.state.on - 5100) / 1.38));

        monitoring.logger(`[MACHINE] -> stop (score: ${context.state.score})`);

        controller.stop();


        networks.processed.store(context.location, context.network, context.state.score);

        if (networks.process.isEmpty()) {
            monitoring.logger('[MACHINE] -> meddle networks');
            networks.processed.meddle();    
        }

        monitore(context.state.score)

        clearContext();
    }

    function _initialize(rawInputs) {
        monitoring.logger(`[MACHINE] -> initialize`);

        computeInputs(Object.assign({}, rawInputs, { distance: null }));

        monitoring.logger(`[MACHINE] -> inputs {blue-fg}${JSON.stringify(context.state.inputs)}{/blue-fg}`);
    }

    function _scored() {
        if (!context.start) { return }

        context.state.score++;
    }
    
    function _play(rawInputs) {
        computeInputs(rawInputs);
        
        // activate network
        const inputs = Object.values(context.state.inputs);
        const [output] = context.network.activate(inputs);

        if (output > 0.55) controller.jump();
        if (output < 0.45) controller.crouch();
    }

    return self();
}