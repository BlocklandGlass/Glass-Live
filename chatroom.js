const moment = require('moment');
const Users = require('./user');

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
  dat = {
    "type": "roomJoin",
    "id": this.id,
    "title": this.title,
    "motd": "Welcome to the Glass Live private beta!\nBe nice, have fun, and find bugs\n"
  };

  clients = [];
  for(i = 0; i < this.users.length; i++) {
    cl = this.users[i];
    uo = Users.getByBlid(cl.blid)
    cli = {
      "username": uo.getUsername(),
      "blid": uo.blid,
      "mod": cl.mod,
      "admin": cl.admin
    };
    clients.push(cli);
  }

  dat.clients = clients;

  c.con.write(JSON.stringify(dat) + '\r\n');

  if(this.users.indexOf(c) > -1) {
    return;
  } else {
    this.users.push(c);
  }

  broad = {
    "type": "roomUserJoin",
    "id": this.id,
    "username": c.username,
    "blid": c.blid,
    "admin": c.admin,
    "mod": c.mod
  };
  this.transmit(JSON.stringify(broad));

  c._addToRoom(this);
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

  // 0 = left
  // 1 = disconnected
  // 2 = kicked

  if(reason != 1) {
    dat = {
      "type": "roomLeave",
      "id": this.id,
      "reason": reason
    };
    c.con.write(JSON.stringify(dat) + '\r\n');
  }

  broad = {
    "type": "roomUserLeave",
    "id": this.id,
    "blid": c.blid,
    "reason": reason
  };
  this.transmit(JSON.stringify(broad));
}

Chatroom.prototype.onCommand = function (client, cmd) {
  arg = cmd.split(" ");
  if(arg[0] == null && arg[0] != "/")
   return;

  arg[0] = arg[0].substring(1);

  switch(arg[0]) {
    case "kick":
      if(arg.length >= 2) {
        if(client.mod) {
          name = "";
          for(var i = 1; i < arg.length; i++) {
            name = name + " " + arg[i];
          }
          name = name.trim();

          for(var i = 0; i < this.users; i++) {
            cl = this.users[i];
            if(cl.username == name) {
              this.removeUser(cl, 2);
            }
          }
        }
      }
      break;

    case "kickid":
      if(arg.length >= 2) {
        if(client.mod) {
          for(var i = 0; i < this.users; i++) {
            cl = this.users[i];
            if(cl.blid == arg[1]) {
              this.removeUser(cl, 2);
            }
          }
        }
      }
      break;

    case "help":
      func = [];
      func[0] = "help\tLists functions";
      func[1] = "kick <username>\tKicks user";
      func[2] = "kickid <blid>\tKicks user by blid";

      for(i = 0; i < func.length; i++) {
        // TODO ml fields tags
        dat = {
          "type": "roomText",
          "id": this.id,
          "text": "<color:dd3300> * " + func[i]
        };
        client.sendRaw(dat);
      }
      break;

    case "uptime":
      dat = {
        "type": "roomText",
        "id": this.id,
        "text": "<color:dd3300> * " + (moment().unix()-global.uptime)
      };
      client.sendRaw(dat);
      break;

    default:
      console.log("unrecognized command: " + arg[0]);
      break;
  }
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

Chatroom.prototype.sendRaw = function (c, msg) {
  dat = {
    "type": "roomText",
    "room": this.id,
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
