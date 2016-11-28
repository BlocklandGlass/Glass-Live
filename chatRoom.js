const moment = require('moment');

const logger = require('./logger');

module.roomCt = 0;

function Chatroom(name, icon) {
  this.name = name;
  this.icon = icon;

  this.id = module.roomCt++;

  this.default = false;
  this.requirement = null;

  this.clients = [];

  this.commandSet = require('./roomCommands').newCommandSet(this);

  this.loadPersist();
}

var create = function(name, icon) {
  var room = new Chatroom(name, icon);

  if(module.rooms == null)
    module.rooms = {};

  module.rooms[room.id] = room;

  return room;
}

var getFromId = function(id) {
  if(module.rooms == null)
    module.rooms = {};

  if(module.rooms[id] == null)
    return false;

  return module.rooms[id];
}

var getList = function(client) {
  var rooms = [];

  if(module.rooms == null)
    module.rooms = {};

  for(i in module.rooms) {
    var room = module.rooms[i];

    if(client != null && room.requirement != null) {
      if(client[room.requirement] != true) {
        continue;
      }
    }

    rooms.push({
      id: room.id,
      image: room.icon,
      title: room.name,
      users: room.clients.length
    });
  }

  return rooms;
}

var getAll = function() {
  return module.rooms;
}

Chatroom.prototype.loadPersist = function() {
  var room = this;
  var fs = require('fs');
  var file = './save/' + room.name.toLowerCase().replace(/ /g, '_') + '.json';
  try {
    fs.statSync(file);
    room.persist = require(file);
  } catch (e) {
    room.persist = {
      motd: "MOTD not set"
    };
  }
}

Chatroom.prototype.savePersist = function() {
  var room = this;
  if(room.persist == null)
    return;

  var fs = require('fs');
  var file = './save/' + room.name.toLowerCase().replace(/ /g, '_') + '.json';
  try {
    fs.writeFileSync(file, JSON.stringify(room.persist));
  } catch (e) {
    logger.error('Error saving chatroom persist!', e);
  }
}

Chatroom.prototype.setMOTD = function(motd) {
  var room = this;
  room.persist.motd = motd;
  room.savePersist();
}

Chatroom.prototype.setDefault = function(bool) {
  this.default = bool;
  return this;
}

Chatroom.prototype.setRequirement = function(key) {
  this.requirement = key;
  return this;
}

Chatroom.prototype.addClient = function(client, isAuto) {
  var room = this;

  var idx = room.clients.indexOf(client);
  if(idx > -1) {
    room.clients.splice(idx, 1);
  }

  client.sendObject({
    type: (isAuto ? "roomJoinAuto" : "roomJoin"),
    title: room.name,
    id: room.id,

    motd: room.persist.motd,

    clients: room.getClientList()
  });

  room.clients.push(client);

  room.sendObject({
    type: "roomUserJoin",
    id: room.id,

    username: client.username,
    blid: client.blid,

    admin: client.isAdmin,
    mod: client.isMod,

    online: true, // depreciated

    status: client.status,
    icon: client.getIcon()
  });

  client._didEnterRoom(room.id);
}

Chatroom.prototype.removeClient = function(client, reason) {
  var room = this;
  if(reason == null)
    reason = -1;

  var idx = room.clients.indexOf(client);
  if(idx > -1) {
    room.clients.splice(idx, 1);
  } else {
    return false;
  }

  room.sendObject({
    type: "roomUserLeave",
    id: room.id,

    blid: client.blid,
    reason: reason
  });

  client._didLeaveRoom(room.id);
}

Chatroom.prototype.kickClient = function(client, reason) {
  var room = this;

  room.removeClient(client, 2);

  client.sendObject({
    type: "roomKicked",
    id: room.id,
    kickReason: reason
  });
}

Chatroom.prototype.getClientList = function() {
  var room = this;
  var clientList = [];
  for(i in room.clients) {
    var client = room.clients[i];
    clientList.push(client.getReference());
  }

  clientList.push({
    username: "GlassBot",
    blid: -1,

    admin: true,
    mod: true,

    online: true, // depreciated

    status: "online",
    icon: "balance"
  });

  return clientList;
}

Chatroom.prototype.sendObject = function(obj) {
  var room = this;
  for(i in room.clients) {
    var client = room.clients[i];
    client.sendObject(obj);
  }
}

Chatroom.prototype.sendClientMessage = function(client, msg) {
  var room = this;
  room.sendObject({
    type: "roomMessage",
    room: room.id,

    sender: client.username,
    sender_id: client.blid,

    msg: msg,

    timestamp: moment().unix(),
    datetime: moment().format('h:mm:ss a')
  });

  require('./glassBot').onRoomMessage(room, client, msg);
}

Chatroom.prototype.findClientByName = function(name, exact) {
  var room = this;

  var closestMatch;

  for(i in room.clients) {
    var cl = room.clients[i];
    if(cl.username.toLowerCase() == name.toLowerCase()) {
      return cl;
    }

    if(cl.username.toLowerCase().indexOf(name.toLowerCase()) == 0) {
      closestMatch = cl;
    }
  }

  if(exact || closestMatch == null) {
    return false;
  } else {
    return closestMatch;
  }
}

Chatroom.prototype.handleCommand = function(client, command, args) {
  var room = this;
  try {
    var ct = room.commandSet.emit(command, client, args)
    if(ct == 0) {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: "<color:e74c3c> * Command not found"
      })
    }
  } catch (e) {
    logger.error("Error handling command " + command, e);
  }
}

module.exports = {create, getFromId, getList, getAll};
