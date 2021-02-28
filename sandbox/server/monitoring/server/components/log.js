const blessed = require('blessed');

exports.Log = (layout, name) => {
    const logger = blessed.log({ 
        keys: true,
        vi: true,
        mouse: true,
        scrollable: true,
        tags: true,
        label: name,
        width: layout.width - 2,
        height: layout.height - 2,
        fg: "green",
        selectedFg: "green",
        border: { type: "line", fg: "cyan" }});

    layout.append(logger);

    return (content) => {
        logger.log(content);
    }
}
