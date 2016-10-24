const EventEmitter = require('events');
const Auth = require('./authCheck');
const Access = require('./accessManager');

const logger = require('./logger');

class ClientConnection extends EventEmitter {}

var createNew = function(socket) {
  var connection = new ClientConnection();

  connection.status = "hidden";
  connection.socket = socket;

  if(module.connections == null)
    module.connections = [];

  module.connections.push(connection);

  connection.on('auth', (data) => {
    Auth.check(data.ident, function(res, error) {
      if(error) {
        logger.error('Unable to auth BL_ID ' + data.blid);
        connection.sendObject({
          "call": "auth",
          "status": "failed",
          "action": "reident",
          "timeout": 5000
        });
        return;
      }

      if(data.blid != res.blid) {
        logger.log('Ident BLID and Auth BLID do not match!');
        return;
      }

      if(res.status != "success") {
        logger.log('authCheck returned non-success: ' + res.status);
        connection.sendObject({
          "call": "auth",
          "status": "failed",
          "action": "reident", //general solution is to just get a new ident
          "timeout": 5000
        });
        return;
      }

      //auth is a success
      connection.blid = res.blid;
      connection.username = res.username;

      connection.isAdmin = res.admin;
      connection.isMod = res.mod;
      connection.isBeta = res.beta;

      logger.log(connection.username + ' (' + connection.blid + ') connected.');

      if(Access.isBanned(connection.blid)) { // TODO this is temp, will be replaced by permissions
        logger.log(connection.username + ' (' + connection.blid + ') is banned!');

        var ban = Access.getBan(blid);
        connection.sendObject({
          "call": "auth",
          "status": "banned",
          "action": "none" //general solution is to just get a new ident
        });

        connection.sendObject({
          "call": "banned",
          "reason": ban.reason,
          "timeRemaining": ban.duration - (moment().diff(ban.time, 'seconds'))
        });
        return;
      } else {
        connection.sendObject({
          "call": "auth",
          "status": "success"
        });

        // TODO room lookup
        global.gd.addClient(connection);
      }
    })
  });

  connection.on('roomChat', (data) => {
    // TODO room lookup
    global.gd.sendClientMessage(connection, data.message);
  });

  return connection;
}

ClientConnection.prototype.sendObject = function(obj) {
  var cl = this;
  cl.socket.write(JSON.stringify(obj) + '\r\n');
}

module.exports = {createNew};
