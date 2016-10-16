module.exports = Client;

const Users = require('./user');
const config = require('./config');
const request = require('request');
const moment = require('moment');
const encoding = require('encoding');

connections = 0;

module.clientgroup = [];

function create(ident, override, callback) {
  var url = "http://" + config.authenticator + "/api/2/authCheck.php?ident=" + ident;
  request(url, function (error, response, body) {
    if(error) { console.error("Error with auth request, ", error); return;  }
    console.log("Response: " + response.statusCode);
    try {
      var res = JSON.parse(body);
    } catch (e) {
      console.error("Error getting auth status from site", e);
      console.log(body);
      return;
    }

    if(res.status == "success") {
      var client = new Client();

      client.blid = res.blid;
      client.username = encoding.convert(res.username, 'ISO-8859-1', 'UTF-8').toString('ascii');
      client.admin = res.admin;
      client.mod = res.mod;
      client.beta = res.beta;

      console.log(client.username);

      Users.get(client.blid, function(user) {
        user.setUsername(client.username);
        user.addClient(client);
        if(user.getPrimaryClient() == false || override) {
          user.setPrimaryClient(client);
        }
        callback(null, client);
      }.bind({client: client, override: override, callback: callback}));
    } else {
      return callback('auth', null);
    }
  }.bind({callback: callback, override: override}));
}

function Client() {
  this.cid = connections;

  this.mod = false;
  this.admin = false;

  this.activity = "idle";

  this.rooms = [];
  this.ignore = [];

  this.messageHistory = [];

  //todo: friends loading

  module.clientgroup.push(this);

  connections++;
}

var broadcast = function (str) {
  for(var i = 0; i < module.clientgroup.length; i++) {
    cl = module.clientgroup[i];
    try {
      cl.write(str);
    } catch (e) {
      continue;
    }
  }
}

Client.prototype.pushMessageHistory = function(msg, room) {
  if(this.messageHistory[room.id] == null)
    this.messageHistory[room.id] = [];

  var mh = this.messageHistory[room.id];

  var obj = {
    "msg": msg,
    "time": moment()
  };

  mh.unshift(obj);
  if(mh.length > 5) {
    mh.splice(0, 5);
  }
}

Client.prototype.spamCheck = function(msg, room) {
  if(this.messageHistory[room.id] == null)
    this.messageHistory[room.id] = [];

  var mh = this.messageHistory[room.id];

  if(mh.length > 0) {
    var last = mh[0]
    if(last.msg == msg) {
      this.sendObject({
        "type": "roomText",
        "id": room.id,
        "text": "<color:dd3300> * Don't repeat yourself."
      });
      return false;
    }
  }

  if(mh.length >= 5) {
    var prev = mh[4];
    if(moment().diff(prev.time, 'milliseconds') < 5000) {
      this.sendObject({
        "type": "roomText",
        "id": room.id,
        "text": "<color:dd3300> * You're typing too fast!"
      });
      return false;
    }
  }

  return true;
}

Client.prototype.sendObject = function(obj) {
  this.write(JSON.stringify(obj));
}

Client.prototype.write = function(str) {
  this.connection.write(str + '\r\n');
}

Client.prototype.disconnect = function(reason) {
  if(reason == null) {
    reason = -1;
  }

  // 0 - server shutdown
  // 1 - other sign-in
  // 2 - barred
  // 3 - kick

  dat = {
    "type":"disconnected",
    "reason": reason
  };

  this.connection.end(JSON.stringify(dat));
  this.cleanUp();
}

Client.prototype.setLocation = function (act, loc) {
  this.activity = act;

  if(act == "playing") {
    this.location = loc;
  } else {
    this.location = "";
  }
};

Client.prototype.sendFriendsList = function () {
  var cl = this;
  Users.get(this.blid, function(user) {
    fl = user.getFriendsList();

    var friends = [];
    var friendCount = fl.length;

    for(i = 0; i < fl.length; i++) {
      blid = fl[i];
      Users.get(blid, function(us) {
        obj = {
          "blid": blid,
          "username": us.getUsername(),
          "online": us.isOnline()
        };
        friends.push(obj);
        if(friends.length == friendCount) {
          dat = {
            "type": "friendsList",
            "friends": friends
          };
          cl.write(JSON.stringify(dat));
        }
      }.bind({friendCount: friendCount, blid: blid, cl: cl, friends: friends}));
    }
    if(friendCount == 0) {
      dat = {
        "type": "friendsList",
        "friends": []
      };
      cl.write(JSON.stringify(dat));
    }
  }.bind({cl: cl}));
}

Client.prototype.sendFriendRequests = function () {
  var cl = this;
  Users.get(this.blid, function(user) {
    fl = user.getFriendRequests();

    var friends = [];
    var friendCount = fl.length;

    for(i = 0; i < fl.length; i++) {
      blid = fl[i];
      Users.get(blid, function(us) {
        obj = {
          "blid": blid,
          "username": us.getUsername()
        };
        friends.push(obj);
        if(friends.length == friendCount) {
          dat = {
            "type": "friendRequests",
            "requests": friends
          };
          cl.write(JSON.stringify(dat));
        }
      }.bind({friendCount: friendCount, blid: blid, cl: cl, friends: friends}));
    }

    if(friendCount == 0) {
      dat = {
        "type": "friendRequests",
        "requests": []
      };
      cl.write(JSON.stringify(dat));
    }
  }.bind({cl: cl}));
}

Client.prototype.sendRaw = function (dat) {
  this.write(JSON.stringify(dat));
}

Client.prototype.cleanUp = function (reason) {
  if(reason == null)
    reason = -1;

  var cl = this;
  Users.get(this.blid, function(user) {
    user.removeClient(cl);

    cl.rooms.forEach(function(room) {
      room.removeUser(cl, reason);
    }.bind({cl: cl, reason: reason}));
  }.bind({cl: cl, reason: reason}));

  idx = module.clientgroup.indexOf(this);
  module.clientgroup.splice(idx, 1);
}

Client.prototype._addToRoom = function (g) {
  this.rooms.push(g);
}

module.exports = {broadcast: broadcast, create: create}
