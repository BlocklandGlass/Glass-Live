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
    module.rooms = [];

  module.rooms.push(room);

  return room;
}

Chatroom.prototype.addClient = function(client, isAuto) {
  var room = this;
  if(room.clients.indexOf(client) == -1) {
    room.clients.push(client);
  }

  client.sendObject({
    type: (isAuto ? "roomJoinAuto" : "roomJoin"),
    title: room.name,
    id: room.id,

    motd: room.motd,

    clients: room.getClientList()
  });
}

Chatroom.prototype.getClientList = function() {
  var room = this;
  var clientList = [];
  for(i in room.clients) {
    var client = room.clients[i];
    clientList.push({
      username: client.username,
      blid: client.blid,

      admin: client.isAdmin,
      mod: client.isMod
    });
  }

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

    msg: msg
  });
}

module.exports = {create};
