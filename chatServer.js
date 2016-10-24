const net = require('net');
const EventEmitter = require('events');

const logger = require('./logger');

const ClientConnection = require('./clientConnection');

var start = function() {
  if(module.listening) return;

  module.chatServer = net.createServer(function(socket) {
    socket.clientConnection = ClientConnection.createNew(socket);
    socket.on('data', (raw) => {
      var rawStr = raw.toString().trim();
      var lines = rawStr.split('\n');
      for(i in lines) {
        var line = lines[i];
        try {
          var obj = JSON.parse(line);
          if(obj.type == null) {
            logger.error("Received invalid call from client", line);
          } else if(socket.clientConnection instanceof EventEmitter) {
            if(!socket.clientConnection.emit(obj.type, obj)) {
              logger.log('Attempted to emit ' + obj.type + ' but no handler was found');
            }
          }
        } catch(e) {
          console.error(e);
          logger.error("Error receiving call from client", line);
        }
      }
    });

    socket.on('error', (error) => {

    });

    socket.on('close', () => {
      if(socket.clientConnection != null) {
        socket.clientConnection.onDisconnect();
      }
    });
  });

  module.chatServer.listen(27003);
  module.listening = true;
  logger.log("Listening on port " + (27003));
}

module.exports = {start};
