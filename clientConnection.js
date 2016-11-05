const EventEmitter = require('events');
const async = require('async');
const Auth = require('./authCheck');

const logger = require('./logger');
const Database = require('./database');
const Permissions = require('./permissions');

const Icons = require('./icons.json');

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
          type: "auth",
          status: "failed",
          action: "reident",
          timeout: 5000
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
          type: "auth",
          status: "failed",
          action: "reident", //general solution is to just get a new ident
          timeout: 5000
        });
        return;
      }

      //auth is a success
      connection.blid = res.blid;
      connection.username = res.username;

      connection.isAdmin = res.admin;
      connection.isMod = res.mod;
      connection.isBeta = res.beta;

      connection.version = data.version;

      logger.log(connection.username + ' (' + connection.blid + ') connected.');

      if(data.version != null && data.version != "") {
        var verParts = connection.version.split(/\./g);
        if(verParts[0] < 3) {
          //2.x, refuse to connect
          logger.log('...running unsupported version ' + data.version);
          connection.disconnect();
          return;
        }

        if(verParts[0] == 3 && verParts[1] < 2) {
          logger.log('...running depreciated version ' + data.version);
        }
      } else {
        logger.log('...without a version field!');
      }

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

        logger.log('Data: ' + JSON.stringify(data));

        connection.persist = data;
        connection.persist.username = res.username;
        connection.savePersist();

        connection._permissionSet = Permissions.createSet(connection.persist);
        connection.listPermissions();


        if(!connection.hasPermission('service_use')) {
          logger.log("Insufficient Permission: service_use");
          if(connection.isTempPermission('service_use')) {
            var tempData = connection.getTempPermData('service_use');
            connection.sendObject({
              type: "barred",
              reason: tempData.reason,
              duration: tempData.duration,
              remaining: tempData.duration-moment().diff(tempData.startTime, 'seconds')
            });
          } else {
            connection.sendObject({
              type: "barred",
              reason: "You've been permanently barred from Glass Live",
              duration: -1,
              remaining: -1
            });
          }
          connection.disconnect();
          return;
        }


        connection.sendObject({
          type: "auth",
          status: "success"
        });

        connection.sendFriendList();
        connection.sendFriendRequests();
        connection.sendBlockedList();
        connection.setStatus('online');

        if(module.clients[connection.blid] != null) {
          module.clients[connection.blid].disconnect();
        }

        module.clients[connection.blid] = connection;

        connection._warningDecay = setInterval(() => {
          if(connection != null) {
            connection.reduceWarnings();
          }
        }, 300000);

        var rooms = require('./chatRoom').getAll();
        for(i in rooms) {
          var room = rooms[i];
          if(room.default) {
            room.addClient(connection, true);
          }

          if(room.requirement != null) {
            if(connection[room.requirement] == true) {
              room.addClient(connection, true);
            }
          }
        }
      })
    })
  });

  connection.on('roomJoin', (data) => {
    if(connection.isInRoom(data.id)) {
      connection.sendObject({
        type: 'error',
        message: "Already in room"
      });
      return;
    }

    if(!connection.hasPermission('rooms_join')) {
      connection.sendObject({
        type: 'messageBox',
        title: "Insufficient permissions",
        text: "You don't have permission to join rooms!"
      })
      return;
    }

    var room = require('./chatRoom').getFromId(data.id);
    if(room != false) {
      if(room.requirement != null) {
        if(connection[room.requirement] != true) {
          connection.sendObject({
            type: 'error',
            message: "Missing requirement"
          });
          return;
        }
      }
      room.addClient(connection);
    }
  });

  connection.on('roomLeave', (data) => {
    if(!connection.isInRoom(data.id)) {
      connection.sendObject({
        type: 'error',
        message: "Tried to leave room not in"
      });
      return;
    }

    var room = require('./chatRoom').getFromId(data.id);
    if(room != false) {
      room.removeClient(connection, 2);
    }
  });

  connection.on('roomChat', (data) => {
    if(!connection.isInRoom(data.room)) {
      connection.sendObject({
        type: 'error',
        message: "Tried to send chat while not in room!"
      });
      return;
    }

    var room = require('./chatRoom').getFromId(data.room);
    if(!connection.hasPermission('rooms_talk')) {
      connection.sendObject({
        type: 'roomText',
        id: data.room,
        text: "You don't have permission to talk!"
      })
      return;
    }

    if(room != false) {
      room.sendClientMessage(connection, data.message);
    }
  });

  connection.on('roomCommand', (data) => {
    if(!connection.isInRoom(data.room)) {
      connection.sendObject({
        type: 'error',
        message: "Tried to send command while not in room!"
      });
      return;
    }

    var room = require('./chatRoom').getFromId(data.room);
    var msg = data.message;

    if(msg == null || msg.trim() == "")
      return;

    if(room != false) {
      var args = msg.split(' ');
      var call = args[0].substr(1);
      args.splice(0, 1);
      logger.log('Got command: ' + call);
      room.handleCommand(connection, call, args);
    }
  });

  connection.on('getRoomList', () => {
    connection.sendObject({
      type: "roomList",
      rooms: require('./chatRoom').getList()
    });
  });

  connection.on('friendRequest', (data) => {
    var target = parseInt(data.target);
    if(target != NaN && target >= 0) {
      connection.sendFriendRequest(data.target);
    } else {
      connection.sendObject({
        type: 'error',
        message: "Invalid BLID!",
        showDialog: true
      });
    }
  });

  connection.on('friendAccept', (data) => {
    var target = parseInt(data.blid);
    if(target != NaN && target >= 0) {
      connection.acceptFriendRequest(data.blid);
    } else {
      connection.sendObject({
        type: 'error',
        message: "Invalid BLID!",
        showDialog: false
      });
    }
  });

  connection.on('friendDecline', (data) => {
    var target = parseInt(data.blid);
    if(target != NaN && target >= 0) {
      connection.declineFriendRequest(data.blid);
    } else {
      connection.sendObject({
        type: 'error',
        message: "Invalid BLID!",
        showDialog: false
      });
    }
  });

  connection.on('friendRemove', (data) => {
    var target = parseInt(data.blid);
    if(target != NaN && target >= 0) {
      connection.removeFriend(data.blid);
    } else {
      connection.sendObject({
        type: 'error',
        message: "Invalid BLID!",
        showDialog: false
      });
    }
  });

  connection.on('setStatus', (data) => {
    var stats = [
      'online',
      'away',
      'busy'
    ];

    if(stats.indexOf(data.status.toLowerCase()) > -1) {
      connection.setStatus(data.status);
    } else {
      connection.sendObject({
        type: "error",
        message: "Invalid Status",
        openDialog: false
      });
    }
  });

  connection.on('setIcon', (data) => {
    connection.setIcon(data.icon, false);
  });

  connection.on('message', (data) => {
    var target = data.target;
    if(module.clients[target] != null) {
      module.clients[target].sendDirectMessage(connection, data.message);
    } else {
      Database.getUsername(target, function(name, err) {
        var username = name;
        if(err != null) {
          username = 'Blockhead' + target;
        }
        connection.sendObject({
          type: "messageNotification",
          chat_blid: target,
          chat_username: username,
          message: "This user is offline."
        })
      })
    }
  });

  connection.on('messageTyping', (data) => {
    var target = data.target;
    if(module.clients[target] != null) {
      module.clients[target].sendObject({
        type: "messageTyping",
        sender: connection.blid,
        typing: data.typing
      });
    }
  });

  connection.on('block', (data) => {
    connection.block(data.blid);
  });

  connection.on('unblock', (data) => {
    connection.unblock(data.blid);
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

  clearInterval(client._warningDecay);

  if(client.disconnectReason == null)
    client.disconnectReason = -1;

  var rooms = require('./chatRoom');

  var roomsIn = client.rooms.slice(0);

  for(i in roomsIn) {
    var id = roomsIn[i];
    rooms.getFromId(id).removeClient(client, client.disconnectReason);
  }

  if(client.persist != null)
    client.setStatus('offline');

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

    online: true, // depreciated
    status: client.status,
    icon: (client.hasPermission('rooms_talk') ? client.getIcon() : "sound_mute")
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
      id: id,
      blid: client.blid,
      status: status
    });
  }

  for(i in client.persist.friends) {
    var friendId = client.persist.friends[i];
    if(module.clients[friendId] != null) {
      module.clients[friendId].sendObject({
        type: "friendStatus",
        blid: client.blid,
        status: status
      });
    }
  }
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
        Database.getUserData(blid, function(data, err) {
          var name = data.username;
          var icon = data.icon;
          if(icon == null)
            icon = "user";

          if(err != null) {
            logger.error('Error loading friend BLID ' + blid + ' for ' + client.blid + ':', err);
            //continue anyways
            callback(null, null);
            return;
          }

          var obj = {
            username: name,
            blid: blid,

            online: false, // depreciated

            status: "offline",
            icon: icon
          };
          callback(null, obj);
        })
      }
    });
  });

  async.parallel(calls, function(err, res) {
    client.sendObject({
      type: "friendsList",
      friends: res
    });
  })
}

ClientConnection.prototype.sendFriendRequests = function() {
  var client = this;
  var friendIds = client.persist.requests;

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

            online: false, // depreciated

            status: "offline"
          };
          callback(null, obj);
        })
      }
    });
  });

  async.parallel(calls, function(err, res) {
    client.sendObject({
      type: "friendRequests",
      requests: res
    });
  })
}

ClientConnection.prototype.sendBlockedList = function() {
  var client = this;
  var friendIds = client.getBlocked();



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

            online: false, // depreciated

            status: "offline"
          };
          callback(null, obj);
        })
      }
    });
  });

  async.parallel(calls, function(err, res) {
    client.sendObject({
      type: "blockedList",
      blocked: res
    });
  })
}

ClientConnection.prototype.sendDirectMessage = function(sender, message) {
  var client = this;

  client.sendObject({
    type: "message",
    sender: sender.username,
    sender_id: sender.blid,
    message: message
  });
}

ClientConnection.prototype.sendFriendRequest = function(to) {
  var client = this;

  if(module.clients[to] != null) {
    module.clients[to].onFriendRequest(client);
  } else {
    Database.getUserData(to, function(data, err) {
      if(err != null) {
        logger.log('sendFriendRequest data error: ' + err);
        return;
      }

      data.requests.push(client.blid);
      Database.saveUserData(to, data);
    });
  }
}

ClientConnection.prototype.onFriendRequest = function(sender) {
  var client = this;
  if(client.persist.requests.indexOf(sender.blid) > -1)
    return;

  client.persist.requests.push(sender.blid);
  client.savePersist();

  client.sendObject({
    type: "friendRequest",
    sender: sender.username,
    sender_blid: sender.blid
  });
}

ClientConnection.prototype.acceptFriendRequest = function(blid) {
  var client = this;
  var idx = client.persist.requests.indexOf(blid);

  if(idx > -1) {
    client.persist.requests.splice(idx, 1);
    client.addFriend(blid, false);
    //we dont need to savePersist as ::addFriend does that

    if(module.clients[blid] != null) {
      module.clients[blid].addFriend(client.blid, true);
    } else {
      Database.getUserData(blid, function(data, err) {
        if(err != null) {
          logger.log('acceptFriendRequest data error: ' + err);
          return;
        }

        if(data.friends.indexOf(client.blid) == -1)
          data.friends.push(client.blid);

        var index = data.requests.indexOf(client.blid);
        if(index > -1)
          data.requests.splice(index, 1);

        Database.saveUserData(blid, data);
      });
    }
  } else {
    client.sendObject({
      type: 'error',
      message: "You don't have a friend request from that person!",
      showDialog: true
    });
  }
}

ClientConnection.prototype.declineFriendRequest = function(blid) {
  var client = this;
  var idx = client.persist.requests.indexOf(blid);

  if(idx == -1)
    return;

  client.persist.requests.splice(idx, 1);
  client.savePersist();
}

ClientConnection.prototype.addFriend = function(blid, wasAccepted) {
  var client = this;

  var idx = client.persist.friends.indexOf(blid);
  if(idx > -1)
    return;

  client.persist.friends.push(blid);
  client.savePersist();

  if(module.clients[blid] != null) {
    //not the cleanest way to do this...
    var friend = module.clients[blid].getReference();
    friend.type = "friendAdd";
    client.sendObject(friend);
  } else {
    Database.getUsername(blid, function(name, err) {
      if(err != null) {
        client.sendObject({
          type: 'error',
          message: 'addFriend called but unable to find username! ' + blid,
          showDialog: false
        });
        return;
      }

      client.sendObject({
        type: 'friendAdd',
        username: name,
        blid: blid
      })
    })
  }
}

ClientConnection.prototype.removeFriend = function(blid) {
  var client = this;
  var idx = client.persist.friends.indexOf(blid);
  if(idx == -1)
    return;

  client.persist.friends.splice(idx, 1);
  client.savePersist();

  if(module.clients[blid] != null) {
    //not the cleanest way to do this...
    var friend = module.clients[blid].getReference();
    friend.type = "friendRemove";
    client.sendObject(friend);

    var ref = client.getReference();
    ref.type = "friendRemove";
    module.clients[blid].sendObject(ref);

    var idx = module.clients[blid].persist.friends.indexOf(client.blid);
    if(idx == -1)
      return;

    module.clients[blid].persist.friends.splice(idx, 1);
    module.clients[blid].savePersist();

  } else {
    Database.getUserData(blid, function(data, err) {
      if(err != null) {
        client.sendObject({
          type: 'error',
          message: 'removeFriend called but unable to find username! ' + blid,
          showDialog: false
        });
        return;
      }

      client.sendObject({
        type: 'friendRemove',
        username: data.username,
        blid: blid
      });

      var idx = data.friends.indexOf(client.blid);
      if(idx > -1)
        data.friends.splice(idx, 1);

      Database.saveUserData(blid, data);
    })
  }
}

ClientConnection.prototype.savePersist = function() {
  var client = this;
  if(client.persist != null) {
    if(client._permissionSet != null) {
      client.persist.permissions = client._permissionSet.perms;
      client.persist.tempPermissions = client._permissionSet.temp;
      logger.log(client.persist.tempPermissions);
    }
    Database.saveUserData(client.blid, client.persist);
  } else {
    logger.error('ClientConnection::savePersist: persist is null for blid ' + client.blid + '!');
  }
}

ClientConnection.prototype.setIcon = function(icon, force) {
  var client = this;

  if(Icons.allowed.indexOf(icon) > -1) {
    client.persist.icon = icon;
  } else if(Icons.restricted.indexOf(icon) > -1) {
    if(client.isMod || client.isAdmin || force) {
      client.persist.icon = icon;
    } else {
      client.sendObject({
        type: "error",
        message: "You don't have permission to use that icon!",
        showDialog: true
      });
    }
  } else {
    client.sendObject({
      type: "error",
      message: "Icon doesn't exist! Setting to default...",
      showDialog: false
    });
    client.persist.icon = "user";
  }

  client.savePersist();
  client._notifyIconChange();
}

ClientConnection.prototype.getIcon = function () {
  var client = this;
  if(client.persist.icon == null) {
    client.persist.icon = "user";
    client.savePersist();
  }

  return client.persist.icon;
}

ClientConnection.prototype.hasPermission = function(perm) {
  var client = this;
  return client._permissionSet.hasPermission(perm);
}

ClientConnection.prototype.isTempPermission = function(perm) {
  var client = this;
  return client._permissionSet.isTempPermission(perm);
}

ClientConnection.prototype.getTempPermData = function(perm) {
  var client = this;
  return client._permissionSet.getTempData(perm);
}

ClientConnection.prototype.setTempPerm = function(perm, val, duration, reason) {
  var client = this;
  client._permissionSet.newTempPermission(perm, val, duration, reason);
  client.savePersist();
}

ClientConnection.prototype.listPermissions = function() {
  var client = this;
  var perms = Permissions.getAll();

  logger.log(client.username + " (" + client.blid + ") permissions:");

  for(i in perms) {
    var perm = perms[i];
    var val = client.hasPermission(perm);
    if(client.isTempPermission(perm)) {
      var data = client.getTempPermData(perm);
      logger.log(perm + "\t" + (val ? "yes" : "no") + "\t" + data.duration + "\t" + data.reason);
    } else {
      logger.log(perm + "\t" + (val ? "yes" : "no"));
    }
  }
}

ClientConnection.prototype.getBlocked = function() {
  var client = this;
  if(client.persist.blocked == null) {
    client.persist.blocked = [];
    client.savePersist();
  }

  return client.persist.blocked;
}

ClientConnection.prototype.isBlocked = function(blid) {
  var client = this;
  if(client.getBlocked().indexOf(blid) > -1)
    return true;

  return false;
}

ClientConnection.prototype.block = function(blid) {
  if(blid < 0 || Math.floor(blid) != blid)
    return;

  var client = this;
  if(client.getBlocked().indexOf(blid) > -1)
    return;

  client.getBlocked().push(blid);
  client.savePersist();
}

ClientConnection.prototype.unblock = function(blid) {
  logger.log('unblock ' + blid);
  var client = this;
  var idx = client.getBlocked().indexOf(blid);

  if(idx == -1)
    return;

  client.persist.blocked.splice(idx, 1);
  client.savePersist();

  logger.log('saving: ' + JSON.stringify(client.persist.blocked));
}

ClientConnection.prototype.roomBan = function(duration, reason) {
  var client = this;
  if(reason == null || reason == "") {
    reason = "You're banned!";
  }
  client.setTempPerm('rooms_join', false, duration, reason);
  client.setTempPerm('rooms_talk', false, duration, reason);
  client.sendObject({
    type: "roomBanned",
    all: true,
    duration: duration,
    reason: reason
  });
}

ClientConnection.prototype.reduceWarnings = function() {
  var client = this;
  if(client.persist.warnings == null)
    client.persist.warnings = 0;

  if(client.persist.warnings > 0) {
    client.persist.warnings--;
  }

  client.savePersist();
}

ClientConnection.prototype.isInRoom = function(id) {
  var client = this;
  return (client.rooms.indexOf(parseInt(id)) > -1);
}

ClientConnection.prototype._notifyIconChange = function(to) {
  var client = this;
  var rooms = require('./chatRoom');

  var icon;
  if(to != null) {
    icon = to;
  } else {
    icon = client.getIcon();
  }

  for(i in client.rooms) {
    var id = client.rooms[i];
    rooms.getFromId(id).sendObject({
      type: "roomUserIcon",
      id: id,
      blid: client.blid,
      icon: icon
    });
  }

  for(i in client.persist.friends) {
    var friendId = client.persist.friends[i];
    if(module.clients[friendId] != null) {
      module.clients[friendId].sendObject({
        type: "friendIcon",
        blid: client.blid,
        icon: icon
      });
    }
  }
}

ClientConnection.prototype._didEnterRoom = function(id) {
  var client = this;
  if(client.rooms.indexOf(id) > -1)
    return;

  client.rooms.push(id);
}

ClientConnection.prototype._didLeaveRoom = function(id) {
  var client = this;
  var idx = client.rooms.indexOf(parseInt(id));
  if(idx > -1)
    client.rooms.splice(idx, 1);
}

module.exports = {createNew, getFromBlid};
