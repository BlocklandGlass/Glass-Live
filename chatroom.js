const moment = require('moment');
const Users = require('./user');

module.exports = Chatroom;

module.chatrooms = 0;
module.chatroomList = {};

var createChatroom = function(title) {
  return new Chatroom(title);
}

var getAllChatrooms = function () {
  return module.chatroomList;
}

function Chatroom(title, image) {
  this.id = module.chatrooms;
  this.title = title;
  this.image = image;

  this.users = [];

  this.clientList = [];

  module.chatroomList[module.chatrooms] = this;
  module.chatrooms++;
  console.log("crid: " + this.id);
  console.log(module.chatroomList)
}

var getFromId = function getFromId(id) {
  id = parseInt(id);
  if(module.chatroomList.hasOwnProperty(id)) {
    return module.chatroomList[id];
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

  cli = {
    "username": c.username,
    "blid": c.blid,
    "mod": c.mod,
    "admin": c.admin
  };

  this.clientList.push(cli);

  dat.clients = this.clientList;
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

  for(var i = 0; i < this.clientList.length; i++) {
    obj = this.clientList[i];
    if(obj.blid == c.blid) {
      this.clientList.splice(i, 1);
    }
  }

  if(reason == null) {
    reason = -1;
  }

  // 0 = left
  // 1 = disconnected
  // 2 = kicked
  // 3 = connection dropped
  // 4 = update

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

          for(var i = 0; i < this.users.length; i++) {
            cl = this.users[i];
            if(cl.username.toLowerCase() == name.toLowerCase()) {
              this.removeUser(cl, 2);
            }
          }
        }
      }
      break;

    case "kickid":
      if(arg.length >= 2) {
        if(client.mod) {
          for(var i = 0; i < this.users.length; i++) {
            cl = this.users[i];
            if(cl.blid == arg[1]) {
              console.log("kicking");
              this.removeUser(cl, 2);
            }
          }
        } else {
          console.log("not mod");
        }
      } else {
        console.log("too few arguments");
      }
      break;

    case "help":
      func = [
        "help\tLists functions",
        "uptime\tGives the server's uptime",
        "time\tGives the local time of the server",
        "kick <username>\tKicks user",
        "kickid <blid>\tKicks user by blid"
      ];

      var str = "<spush><tab:120, 220><color:dd3300>";
      for(i = 0; i < func.length; i++) {
        str = str + "\n * " + func[i]
      }
      str = str + "<spop>";

      dat = {
        "type": "roomText",
        "id": this.id,
        "text": str
      };
      client.sendRaw(dat);
      break;

    case "uptime":
      seconds = (moment().unix()-global.uptime);
      minutes = Math.floor(seconds/60);
      hours = Math.floor(minutes/60);
      days = Math.floor(hours/24);

      seconds = seconds % 60;
      minutes = minutes % 60;
      hours = hours % 24;

      str = "";
      if(days > 0) {
        str += " " + days + "d";
      }

      if(hours > 0) {
        str += " " + hours + "h";
      }

      if(minutes > 0) {
        str += " " + minutes + "m";
      }

      if(seconds > 0) {
        str += " " + seconds + "s";
      }

      str = str.trim();

      dat = {
        "type": "roomText",
        "id": this.id,
        "text": "<color:dd3300> * Uptime: " + str
      };
      client.sendRaw(dat);
      break;

    case "time":
      dat = {
        "type": "roomText",
        "id": this.id,
        "text": "<color:dd3300> * Local Time: " + moment().format('h:mm:ss a')
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
  if(this.users.indexOf(c) == -1) {
    console.log("User attempted chat outside of room");
    return;
  }

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

module.exports = {getFromId: getFromId, createChatroom: createChatroom, getAllChatrooms: getAllChatrooms}
