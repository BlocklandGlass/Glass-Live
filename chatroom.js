const moment = require('moment');
const Users = require('./user');

module.exports = Chatroom;

module.chatrooms = 0;
module.chatroomList = {};

var createChatroom = function(title, image) {
  return new Chatroom(title, image);
}

var getAllChatrooms = function () {
  return module.chatroomList;
}

function Chatroom(title, image) {
  this.id = module.chatrooms;
  this.title = title;
  this.image = image;

  this.clients = [];

  this.clientList = [];

  this.mute = [];
  this.muteTimer = []

  module.chatroomList[module.chatrooms] = this;
  module.chatrooms++;
}

var getFromId = function getFromId(id) {
  id = parseInt(id);
  if(module.chatroomList.hasOwnProperty(id)) {
    return module.chatroomList[id];
  } else {
    return false;
  }
}

var getFromName = function getFromTitle(title) {
  for(var i = 0; i < module.chatrooms; i++) {
    if(module.chatroomList[i].title == title)
      return module.chatroomList[i];
  }

  return false;
}

Chatroom.prototype.addClient = function (c) {
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
  c.sendObject(dat);

  if(this.clients.indexOf(c) > -1) {
    return;
  } else {
    this.clients.push(c);
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
  idx = this.clients.indexOf(c);
  if(idx > -1) {
    this.clients.splice(idx, 1);
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
    c.sendObject(dat);
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

          for(var i = 0; i < this.clients.length; i++) {
            cl = this.clients[i];
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
          for(var i = 0; i < this.clients.length; i++) {
            cl = this.clients[i];
            if(cl.blid == arg[1]) {
              console.log("kicking");
              this.removeUser(cl, 2);
              cl.disconnect(1);
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
        "kickid <blid>\tKicks user by blid",
        "mute <time> <user>\tMutes the user for <time> minutes",
        "afk\tToggles afk status",
        "away\tAlias of afk",
        "ignore <username>\tHide user's messages",
        "getid <username>\tGives user's BL_ID"
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

    case "ignore":
      if(arg.length >= 2) {
        name = "";
        for(var i = 1; i < arg.length; i++) {
          name = name + " " + arg[i];
        }
        name = name.trim();

        for(var i = 0; i < this.clients.length; i++) {
          cl = this.clients[i];
          if(cl.username.toLowerCase() == name.toLowerCase()) {
            if(client.ignore.indexOf(cl.blid) == -1)
              client.ignore.push(cl.blid);

            dat = {
              "type": "roomText",
              "id": this.id,
              "text": "<color:dd3300> * Ignoring " + cl.username + " (" + cl.blid + ") in all rooms."
            };
            client.sendRaw(dat);
            return;
          }
        }

        dat = {
          "type": "roomText",
          "id": this.id,
          "text": "<color:dd3300> * User not found."
        };
        client.sendRaw(dat);
      }
      break;

    case "unignore":
      if(arg.length >= 2) {
        name = "";
        for(var i = 1; i < arg.length; i++) {
          name = name + " " + arg[i];
        }
        name = name.trim();

        for(var i = 0; i < this.clients.length; i++) {
          cl = this.clients[i];
          if(cl.username.toLowerCase() == name.toLowerCase()) {
            idx = client.ignore.indexOf(cl.blid);
            if(idx == -1)
              return;


            client.ignore.splice(idx, 1);

            dat = {
              "type": "roomText",
              "id": this.id,
              "text": "<color:dd3300> * Unignored " + cl.username + "."
            };
            client.sendRaw(dat);
            return;
          }
        }

        dat = {
          "type": "roomText",
          "id": this.id,
          "text": "<color:dd3300> * User not found."
        };
        client.sendRaw(dat);
      }
      break;

    case "mute":
      if(!client.mod)
        return;

      if(arg.length >= 3) {
        name = "";
        for(var i = 2; i < arg.length; i++) {
          name = name + " " + arg[i];
        }
        name = name.trim();

        for(var i = 0; i < this.clients.length; i++) {
          var cl = this.clients[i];
          if(cl.username.toLowerCase() == name.toLowerCase()) {
            if(this.mute.indexOf(cl.blid) == -1)
              this.mute.push(cl.blid);

            if(this.muteTimer[cl.blid] != null)
              clearTimeout(this.muteTimer[cl.blid]);

            var cr = this;
            var duration = 60000*arg[1];
            console.log(duration);

            this.muteTimer[cl.blid] = setTimeout(function () {
              console.log("unmute");
              idx = cr.mute.indexOf(cl.blid);
              if(idx > -1)
                cr.mute.splice(idx, 1);

              if(cr.muteTimer[cl.blid] != null)
                clearTimeout(cr.muteTimer[cl.blid]);

              dat = {
                "type": "roomText",
                "id": cr.id,
                "text": "<color:dd3300> * " + cl.username + " (" + cl.blid + ") was unmuted. [Timeout]"
              };
              cr.transmit(JSON.stringify(dat));
            }.bind({cr: cr, cl: cl}), duration);

            var durStr = ""
            if(duration%60000 == duration) {
              durStr = Math.floor(duration/1000) + " seconds";
            } else if(duration%(60 * 60 * 1000) < duration) {
              durStr = Math.floor(duration/(60 * 60 * 1000)) + " hours";
            } else {
              durStr = Math.floor(duration/(60 * 1000)) + " minutes";
            }

            dat = {
              "type": "roomText",
              "id": this.id,
              "text": "<color:dd3300> * " + cl.username + " (" + cl.blid + ") was muted for " + durStr + "."
            };
            this.transmit(JSON.stringify(dat));
            return;
          }
        }

        dat = {
          "type": "roomText",
          "id": this.id,
          "text": "<color:dd3300> * User not found."
        };
        client.sendRaw(dat);
      } else {
        dat = {
          "type": "roomText",
          "id": this.id,
          "text": "<color:dd3300> * /mute <minutes> <name>"
        };
        client.sendRaw(dat);
      }
      break;

    case "unmute":
      if(!client.mod)
        return;

      if(arg.length >= 2) {
        name = "";
        for(var i = 1; i < arg.length; i++) {
          name = name + " " + arg[i];
        }
        name = name.trim();

        for(var i = 0; i < this.clients.length; i++) {
          cl = this.clients[i];
          if(cl.username.toLowerCase() == name.toLowerCase()) {
            idx = this.mute.indexOf(cl.blid);
            if(idx > -1) {
              this.mute.splice(idx, 1);

              if(this.muteTimer[cl.blid] != null)
                clearTimeout(this.muteTimer[cl.blid]);

              dat = {
                "type": "roomText",
                "id": this.id,
                "text": "<color:dd3300> * " + cl.username + " (" + cl.blid + ") was unmuted. [Manual]"
              };
              this.transmit(JSON.stringify(dat));
            }
            return;
          }
        }

        dat = {
          "type": "roomText",
          "id": this.id,
          "text": "<color:dd3300> * User not found."
        };
        client.sendRaw(dat);
      }
      break;

    case "away":
    case "afk":
      if(client.afk === true) {
        dat = {
          "type": "roomText",
          "id": this.id,
          "text": "<color:bb33cc> * " + client.username + " is back"
        };
        client.afk = false;
      } else {
        dat = {
          "type": "roomText",
          "id": this.id,
          "text": "<color:bb00cc> * " + client.username + " is now away"
        }
        client.afk = true;
      }
      this.transmit(JSON.stringify(dat));
      break;

    case "unafk":
    case "back":
      if(client.afk === false)
        return;

      dat = {
        "type": "roomText",
        "id": this.id,
        "text": "<color:bb33cc> * " + client.username + " is back"
      };
      client.afk = false;
      this.transmit(JSON.stringify(dat));
      break;

    case "getid":
      if(arg.length >= 2) {
        name = "";
        for(var i = 1; i < arg.length; i++) {
          name = name + " " + arg[i];
        }
        name = name.trim();

        for(var i = 0; i < this.clients.length; i++) {
          cl = this.clients[i];
          if(cl.username.toLowerCase() == name.toLowerCase()) {
            dat = {
              "type": "roomText",
              "id": this.id,
              "text": "<color:dd3300> * " + cl.username + "'s BL_ID is " + cl.blid
            };
            client.sendRaw(dat);
            return;
          }
        }
        dat = {
          "type": "roomText",
          "id": this.id,
          "text": "<color:dd3300> * User not found."
        };
        client.sendRaw(dat);
        return;
      } else {
        dat = {
          "type": "roomText",
          "id": this.id,
          "text": "<color:dd3300> * /getid <username>"
        };
        client.sendRaw(dat);
      }
      break;

    default:
      console.log("unrecognized command: " + arg[0]);
      break;
  }
}

Chatroom.prototype.transmit = function (msg) {
  for(i = 0; i < this.clients.length; i++) {
    c = this.clients[i];
    c.write(msg);
  }
}

Chatroom.prototype.sendMessage = function (c, msg) {
  if(this.clients.indexOf(c) == -1) {
    console.log("User attempted chat outside of room");
    return;
  }

  if(this.mute.indexOf(c.blid) > -1) {
    dat = {
      "type": "roomText",
      "id": this.id,
      "text": "<color:dd3300> * You're muted!"
    };
    c.sendRaw(dat);
    return;
  }

  if(!c.spamCheck(msg, this)) {
    return;
  }
  c.pushMessageHistory(msg, this)

  var dat = {
    "type": "roomMessage",
    "room": this.id,
    "sender": c.username,
    "sender_id": c.blid,
    "msg": msg,
    "timestamp": moment().unix(),
    "datetime": moment().format('h:mm:ss a')
  };

  var msg = JSON.stringify(dat);

  for(i = 0; i < this.clients.length; i++) {
    cl = this.clients[i];
    if(cl.ignore.indexOf(c.blid) == -1)
      cl.write(msg);
  }
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

module.exports = {getFromId: getFromId, createChatroom: createChatroom, getAllChatrooms: getAllChatrooms, getFromTitle: getFromName}
