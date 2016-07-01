const moment = require('moment');

module.exports = Chatroom;

var chatrooms = 0;
var chatroom = [];

function Chatroom(title) {
  this.id = chatrooms;
  this.title = title;
  this.users = [];

  chatroom[chatrooms] = this;
  chatrooms++;
}

function getFromId(id) {
  if(chatroom.indexOf(id) > -1) {
    return chatroom[id];
  } else {
    return false;
  }
}

Chatroom.prototype.addUser = function (c) {
  if(this.users.indexOf(c) > -1) {
    return;
  } else {
    this.users.push(c);
  }

  dat = {
    "type": "roomJoin",
    "id": this.id,
    "title": this.title,
    "motd": "Welcome to the Glass Live private beta!\nBe nice, have fun, and find bugs\n\nNah but you really shouldn't be here"
  };
  c.con.write(JSON.stringify(dat) + '\r\n');

  broad = {
    "type": "roomUserJoin",
    "id": this.id,
    "username": c.username,
    "blid": c.blid
  };
  this.transmit(JSON.stringify(broad));

  c._addToRoom(this.id);
}

Chatroom.prototype.removeUser = function (c, reason) {
  idx = this.users.indexOf(c);
  if(idx > -1) {
    this.users.splice(idx, 1);
  } else {
    return;
  }

  if(reason == null) {
    reason = -1;
  }

  dat = {
    "type": "roomLeave",
    "id": this.id,
    "reason": reason
  };
  c.con.write(JSON.stringify(dat) + '\r\n');

  broad = {
    "type": "roomUserLeave",
    "id": this.id,
    "blid": c.blid,
    "reason": reason
  };
  this.transmit(JSON.stringify(broad));
}

Chatroom.prototype.transmit = function (msg) {
  for(i = 0; i < this.users.length; i++) {
    c = this.users[i];
    c.con.write(msg + '\r\n');
  }
}

Chatroom.prototype.sendMessage = function (c, msg) {
  dat = {
    "type": "roomMessage",
    "room": this.id,
    "sender": c.username,
    "sender_id": c.blid,
    "msg": msg,
    "timestamp": moment().unix(),
    "datetime": moment().format('h:mm:ss a')
  };
  this.transmit(JSON.stringify(dat));
}

Chatroom.prototype.broadcast = function (msg) {
  dat = {
    "type": "roomBroadcast",
    "room": this.id,
    "msg": msg,
    "timestamp": moment().unix(),
    "datetime": moment().format('h:mm:ss a')
  };
  this.transmit(JSON.stringify(dat));
}
