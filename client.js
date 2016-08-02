module.exports = Client;

const Users = require('./user');
const config = require('./config');


connections = 0;

var clientGroup = [];

function Client(con) {
  this.con = con;
  this.cid = connections;

  this.mod = false;
  this.admin = false;

  this.activity = "idle";

  this.rooms = [];

  //todo: friends loading

  clientGroup.push(this);

  connections++;
}

var create = function (con) {
  return new Client(con);
}

var broadcast = function (str) {
  for(var i = 0; i < clientGroup.length; i++) {
    cl = clientGroup[i];
    cl.con.write(str + '\r\n');
  }
}

Client.prototype.authCheck = function (ident) {
  var request = require('sync-request');

  if(config.authenticator == "bypass") {
    this.blid = 27323;
    this.username = "BLG";
    this.admin = 1;
    this.mod = 1;
    return true;
  }

  var req = request('GET', "http://" + config.authenticator + "/api/2/authCheck.php?ident=" + ident)

  try {
    res = JSON.parse(req.getBody());
  } catch (e) {
    console.log("Error authenticating user");
    console.log(req.getBody().toString('utf8'));
    this.con.write('{"type":"auth", "status":"success"}\r\n');
    return false;
  }

  if(res.status == "success") {
    this.blid = res.blid;
    this.username = res.username;
    this.admin = res.admin;
    this.mod = res.mod;

    if(!res.beta) {
      console.log("Not beta");
      return false;
    }

    return true;
  } else {
    return false;
  }
};

Client.prototype.disconnect = function(reason) {
  if(reason == null) {
    reason = -1;
  }

  // 0 - server shutdown
  // 1 - other sign-in
  // 2 - barred

  dat = {
    "type":"disconnected",
    "reason": reason
  };

  this.con.end(JSON.stringify(dat));
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
  console.log("[debug] sendFriendsList");
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
          cl.con.write(JSON.stringify(dat) + '\r\n');
        }
      }.bind({friendCount: friendCount, blid: blid, cl: cl, friends: friends}));
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
      console.log("[fl.length] " + fl.length);
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
          cl.con.write(JSON.stringify(dat) + '\r\n');
        }
      }.bind({friendCount: friendCount, blid: blid, cl: cl, friends: friends}));
    }
  }.bind({cl: cl}));
}

Client.prototype.sendRaw = function (dat) {
  this.con.write(JSON.stringify(dat) + '\r\n');
}

Client.prototype.cleanUp = function () {
  var cl = this;
  Users.get(this.blid, function(user) {
    user.removeClient(cl);

    for(i = 0; i < cl.rooms.length; i++) {
      cl.rooms[i].removeUser(cl, 1);
    }
  }.bind({cl: cl}));
  idx = clientGroup.indexOf(this);
  clientGroup.splice(idx, 1);
}

Client.prototype._addToRoom = function (g) {
  this.rooms.push(g);
}

module.exports = {broadcast: broadcast, create: create}
