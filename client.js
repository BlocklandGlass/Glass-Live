const logger = require('./logger');

const Users = require('./user');
const config = require('./config');
const request = require('request');
const moment = require('moment');
const encoding = require('encoding');

const Access = require('./AccessManager');

module.connections = 0;

module.clientgroup = [];

function create(ident, override, callback) {
  var url = "http://" + config.authenticator + "/api/2/authCheck.php?ident=" + ident;
  request(url, function (error, response, body) {
    if(error) { console.error("Error with auth request, ", error); return;  }

    if(response.statusCode != 200) {
      logger.error("Error creating Client, authCheck response: " + response.statusCode);
      callback('error', null);
    }

    try {
      var res = JSON.parse(body);
    } catch (e) {
      logger.error("Error getting auth status from site", e);
      logger.log(body);
      return;
    }

    if(res.status == "success") {
      var client = new Client();

      client.blid = res.blid;
      client.username = res.username;
      client.admin = res.admin;
      client.mod = res.mod;
      client.beta = res.beta;

      logger.log(client.username + ' (' + client.blid ') connected');

      if(Access.isBanned(res.blid)) {
        logger.log(client.username + ' (' + client.blid ') is banned!');
        var ban = Access.getBan(blid);

        client.sendObject({
          "call": "banned",
          "reason": ban.reason,
          "timeRemaining": ban.duration - (moment().diff(ban.time, 'seconds'))
        });
        client.disconnect(2);
        return callback('banned', null);
      }

      Users.get(client.blid, function(user) {
        user.setUsername(client.username);
        user.addClient(client);
        if(user.getPrimaryClient() == false || override) {
          user.setPrimaryClient(client);
        }
        callback(null, client);
      });
    } else {
      return callback('auth', null);
    }
  });
}

function Client() {
  this.warnings = 0;

  this.mod = false;
  this.admin = false;

  this.activity = "idle";

  this.rooms = [];
  this.ignore = [];

  this.messageHistory = [];

  module.clientgroup.push(this);
}

//================================================================
// Client connections
//================================================================

var broadcast = function (str) {
  for(var i = 0; i < module.clientgroup.length; i++) {
    var cl = module.clientgroup[i];
    try {
      cl.write(str);
    } catch (e) {
      continue;
    }
  }
}

var broadcastObject = function (obj) {
  var str;
  try {
    str = JSON.stringify(obj)
  } catch (e) {
    logger.log("JSON stringify error", e);
    return;
  }

  for(var i = 0; i < module.clientgroup.length; i++) {
    var cl = module.clientgroup[i];
    try {
      cl.write(str);
    } catch (e) {
      continue;
    }
  }
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
  // 2 - banned
  // 3 - kick

  var dat = {
    "type":"disconnected",
    "reason": reason
  };

  this.connection.end(JSON.stringify(dat));
  this.cleanUp();
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
    });
  });

  var idx = module.clientgroup.indexOf(cl);
  module.clientgroup.splice(idx, 1);
}

//================================================================
// Chat
//================================================================

Client.prototype.pushMessageHistory = function(msg, room) {
  var client = this;
  if(client.messageHistory[room.id] == null)
    client.messageHistory[room.id] = [];

  var mh = client.messageHistory[room.id];

  var obj = {
    "msg": msg,
    "time": moment()
  };

  client.messageHistory.push(obj);
  client.lastMessage = obj;
}

Client.prototype.spamCheck = function(msg, room) {
  var client = this;

  if(client.messageHistory[room.id] == null)
    client.messageHistory[room.id] = [];

  var mh = client.messageHistory[room.id];

  if(mh.length > 0) {
    var last = client.lastMessage;
    if(last.msg.trim() == msg.trim()) {
      this.sendObject({
        "type": "roomText",
        "id": room.id,
        "text": "<color:dd3300> * Don't repeat yourself."
      });
      return false;
    }
  }

  //5 messages in 5 seconds
  if(mh.length >= 5) {
    var prev = mh[mh.length-5];
    if(moment().diff(prev.time, 'milliseconds') < 5000) {
      client.sendObject({
        "type": "roomText",
        "id": room.id,
        "text": "<color:dd3300> * You're typing too fast!"
      });
      client.issueWarning();
      return false;
    }
  }

  return true;
}

Client.prototype.issueWarning = function() {
  var client = this;
  client.warnings++;
  logger.log(client.username + ' (' + client.blid + ') now has ' + client.warnings + ' warnings');

  if(client.warnings) {

  }
}


//================================================================
// Activity
//================================================================

Client.prototype.setLocation = function (act, loc) {
  this.activity = act;

  if(act == "playing") {
    this.location = loc;
  } else {
    this.location = "";
  }
};


//================================================================
// Friends
//================================================================

Client.prototype.sendFriendsList = function () {
  var cl = this;
  Users.get(this.blid, function(user) {
    var fl = user.getFriendsList();

    var friends = [];
    var friendCount = fl.length;

    for(i = 0; i < fl.length; i++) {
      var blid = fl[i];
      Users.get(blid, function(us) {
        var obj = {
          "blid": blid,
          "username": us.getUsername(),
          "online": us.isOnline()
        };
        friends.push(obj);
        if(friends.length == friendCount) {
          var dat = {
            "type": "friendsList",
            "friends": friends
          };
          cl.write(JSON.stringify(dat));
        }
      }.bind({friendCount: friendCount, blid: blid, cl: cl, friends: friends}));
    }
    if(friendCount == 0) {
      var dat = {
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
    var fl = user.getFriendRequests();

    var friends = [];
    var friendCount = fl.length;

    for(i = 0; i < fl.length; i++) {
      var blid = fl[i];
      Users.get(blid, function(us) {
        var obj = {
          "blid": blid,
          "username": us.getUsername()
        };
        friends.push(obj);
        if(friends.length == friendCount) {
          var dat = {
            "type": "friendRequests",
            "requests": friends
          };
          cl.write(JSON.stringify(dat));
        }
      }.bind({friendCount: friendCount, blid: blid, cl: cl, friends: friends}));
    }

    if(friendCount == 0) {
      var dat = {
        "type": "friendRequests",
        "requests": []
      };
      cl.write(JSON.stringify(dat));
    }
  }.bind({cl: cl}));
}

Client.prototype._addToRoom = function (g) {
  this.rooms.push(g);
}

module.exports = {broadcast: broadcast, create: create}
