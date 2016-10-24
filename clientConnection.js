const EventEmitter = require('events');
const async = require('async');
const Auth = require('./authCheck');
const Access = require('./accessManager');

const logger = require('./logger');
const Database = require('./database');

class ClientConnection extends EventEmitter {}

var getFromBlid = function(blid) {
  if(module.clients == null)
    module.clients = {};

  if(module.clients[blid] != null)
    return module.clients[blid];
  else
    return false;
}

var createNew = function(socket) {
  var connection = new ClientConnection();

  connection.status = "hidden";
  connection.socket = socket;

  connection.rooms = [];

  if(module.connections == null)
    module.connections = [];

  if(module.clients == null)
    module.clients = {};

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

      module.clients[connection.blid] = connection;

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
        Database.getUserData(connection.blid, function(data, err) {
          if(err != null) {
            logger.error('Failed to load data for clientConnection ' + connection.blid + ':', err);
            connection.sendObject({
              type: 'error',
              message: "Glass Live encountered an internal error and was unable to load your data.<br><br>This issue has been recorded. Sorry for any inconvenience",
              showDialog: true
            });
            connection.disconnect();
            return;
          }
          logger.log('Got user data for clientConnection ' + connection.blid)
          connection.persist = data.data;

          connection.sendObject({
            "call": "auth",
            "status": "success"
          });

          logger.log(JSON.stringify(connection.persist));

          connection.sendFriendList();

          // TODO room lookup
          global.gd.addClient(connection);
        })
      }
    })
  });

  connection.on('roomChat', (data) => {
    // TODO room lookup
    global.gd.sendClientMessage(connection, data.message);
  });

  connection.on('getRoomList', () => {
    connection.sendObject({
      type: "roomList",
      rooms: require('./chatRoom').getList()
    });
  });

  connection.on('setStatus', (data) => {
    var stats = [
      'online',
      'away',
      'busy'
    ];

    if(stats.indexOf(data.status.toLowercas()) > -1) {
      connection.setStatus(data.status);
    } else {
      connection.sendObject({
        type: "error",
        message: "Invalid Status",
        openDialog: false
      });
    }
  });

  return connection;
}

ClientConnection.prototype.sendObject = function(obj) {
  var cl = this;
  if(cl.socket != null && !cl.socket.destroyed) {
    cl.socket.write(JSON.stringify(obj) + '\r\n');
  } else {
    logger.error("Tried to write to closed connection, something wasn't handled right!");
  }
}

ClientConnection.prototype.kick = function(reason) {
  var client = this;

  var str;
  if(reason == null) {
    str = "Unspecified";
  } else {
    str = reason;
  }

  client.sendObject({
    type: "kicked",
    reason: str
  });

  logger.log("TODO : remove client from rooms after kick");

  client.disconnect(2);
}

ClientConnection.prototype.onDisconnect = function(code) {
  var client = this;
  if(client.socket != null) {
    if(client.blid != null) {
      logger.log(client.username + ' (' + client.blid + ') disconnected.');
    }

    if(!client.socket.destroyed) {
      client.socket.end();
      client.socket = undefined;
    }
  }

  client.cleanUp();
}

ClientConnection.prototype.disconnect = function(code) {
  var client = this;
  if(client.socket != null) {
    client.sendObject({
      type: "disconnect",
      reason: code
    });

    if(client.blid != null) {
      logger.log("Sent disconnect to BL_ID " + client.blid);
    }

    if(!client.socket.destroyed) {
      client.socket.destroy();
      client.socket = undefined;
    }
  }

  client.cleanUp();
}

ClientConnection.prototype.cleanUp = function() {
  var client = this;
  if(client.disconnectReason == null)
    client.disconnectReason = -1;

  var rooms = require('./chatRoom');

  var roomsIn = client.rooms.slice(0);

  for(i in roomsIn) {
    var id = roomsIn[i];
    rooms.getFromId(id).removeClient(client, client.disconnectReason);
  }

  if(module.clients[client.blid] != null && client.blid != null)
    module.clients[client.blid] = undefined;

  var idx = module.connections.indexOf(client);
  if(idx > -1)
    module.connections.splice(idx, 1);

  if(client.socket != null && !client.socket.destroyed) {
    client.socket.destroy();
  }
  client.socket = undefined;
}

ClientConnection.prototype.getReference = function() {
  var client = this;
  return {
    username: client.username,
    blid: client.blid,

    admin: client.isAdmin,
    mod: client.isMod,

    status: client.status
  };
}

ClientConnection.prototype.setStatus = function(status) {
  var client = this;
  var rooms = require('./chatRoom');

  client.status = status;

  for(i in client.rooms) {
    var id = client.rooms[i];
    rooms.getFromId(id).sendObject({
      type: "roomUserStatus",
      blid: client.blid,
      status: status
    });
  }

  logger.log('TODO : setStatus friends');
}

ClientConnection.prototype.sendFriendList = function() {
  var client = this;
  var friendIds = client.persist.friends;

  var calls = [];

  friendIds.forEach(function(blid) {
    calls.push(function(callback) {
      if(module.clients[blid] != null) {
        var obj = module.clients[blid].getReference();
        callback(null, obj);
      } else {
        Database.getUsername(blid, function(name, err) {
          if(err != null) {
            logger.error('Error loading friend BLID ' + blid + ' for ' + client.blid + ':', err);
            //continue anyways
            callback(null, null);
            return;
          }

          var obj = {
            username: name,
            blid: blid,
            status: "offline"
          };
          callback(null, obj);
        })
      }
    });
  });

  async.parallel(calls, function(err, res) {
    logger.log('error: ' + err);
    logger.log('res: ' + res);
    client.sendObject({
      type: "friendsList",
      friends: res
    });
  })
}

ClientConnection.prototype._didEnterRoom = function(id) {
  var client = this;
  if(client.rooms.indexOf(id) > -1)
    return;

  client.rooms.push(id);
}

module.exports = {createNew, getFromBlid};
