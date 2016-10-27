const moment = require('moment');

module.roomCt = 0;

function Chatroom(name, icon) {
  this.name = name;
  this.icon = icon;

  this.id = module.roomCt++;

  this.clients = [];
  this.motd = "TODO -> MOTD loading/saving";
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

var getList = function() {
  var rooms = [];

  if(module.rooms == null)
    module.rooms = {};

  for(i in module.rooms) {
    var room = module.rooms[i];
    rooms.push({
      id: room.id,
      image: room.icon,
      title: room.name,
      users: room.clients.length
    });
  }

  return rooms;
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

    motd: room.motd,

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

    status: "online",
    icon: "balance_unbalance"
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
}

module.exports = {create, getFromId, getList};
