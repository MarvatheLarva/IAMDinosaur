require('dotenv').config();

const udp = require('dgram');

const { Terminal } = require('./monitoring/terminal');

const server = udp.createSocket('udp4');
const terminal = Terminal();

server
  .on('error', handleError(server))
  .on('message', handleMessage(server))
  .on('close', handleClose(server))
  .bind(process.env.MONITORING_SERVER_PORT);

function handleClose(server) { return () => {
  process.exit();
}}

function handleError(server) { return (error) => {
  console.log('Error: ' + error);
  server.close();
}}

function handleMessage(server) { return (msg, info) => {
    const payload = JSON.parse(msg.toString());
    terminal.update(payload.probe, payload.data);
}}
