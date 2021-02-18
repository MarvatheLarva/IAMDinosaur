exports.PROBE_TYPES = {
  time: 'time'
}

exports.probe = async function (config, client, func) {
    const start = process.hrtime.bigint();
    
    await func();

    const end = process.hrtime.bigint();

    const time = Number(end - start); // nano seconds
    
    client(Object.assign({}, config, { measure: time }));
}