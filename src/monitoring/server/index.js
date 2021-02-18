const udp = require('dgram');
const { Terminal } = require('./terminal');

const PORT = 2222;

const server = udp.createSocket('udp4');
const terminal = Terminal();

server
  .on('error', handleError(server))
  .on('message',handleMessage(server, terminal))
  .on('listening', handleListening(server, terminal))
  .on('close', handleClose(server))
  .bind(PORT);

function handleClose(server) { return () => {
  process.exit();
}}

function handleError(server) { return (error) => {
  console.log('Error: ' + error);
  server.close();
}}

function handleMessage(server, terminal) { return (msg, info) => {
  terminal.addProbe(JSON.parse(msg.toString()))
}}

function handleListening(server, terminal) { return () => {
  const address = server.address();
  const state = { count: 0 };

  terminal.init(server);
}}

