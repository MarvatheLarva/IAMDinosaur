const robot = require('robotjs');
const { probe, PROBE_TYPES } = require('../monitoring/probe.js');
const { converters } = require('../utils.js');

exports.Distance = (config) => {

    const state = {
        active: false
    }

    function compute(element) {

    }

    return (callback) => {
        const interval = setInterval(() => {
            // probe(probeConfig, config.monitoring.client, async () => {
                callback(compute);
            // });
        }, config.frequency);
    }
}
