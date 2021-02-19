exports.PROBE_TYPES = {
  time: 'time',
  log: 'log'
}

exports.probe = async function (config, client, func) {
    const start = process.hrtime.bigint();
    
    await func();

    const end = process.hrtime.bigint();

    const time = Number(end - start); // nano seconds
    
    if (!config.mute) { client(Object.assign({}, config, { measure: time })) }
}