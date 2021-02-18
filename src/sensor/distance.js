const robot = require('robotjs');
const { probe, PROBE_TYPES } = require('../monitoring/probe.js');
const { converters } = require('../utils.js');

exports.Distance = () => {

    const state = {
        active: false
    }

    function compute(element) {

    }

    return (callback) => {
        const interval = setInterval(() => {
            probe(probeConfig, config.monitoring.client, async () => {
                callback(compute);
            });
        }, 1000);
    }
}
