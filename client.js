module.exports = Client;

const Users = require('./user');
const config = require('./config');


connections = 0;

function Client(con) {
  this.con = con;
  this.cid = connections;

  this.mod = false;
  this.admin = false;

  this.activity = "idle";

  this.rooms = [];

  //todo: friends loading

  connections++;
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

  res = JSON.parse(req.getBody());

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
  user = Users.getByBlid(this.blid);
  fl = user.getFriendsList();

  console.log("[fl.length] " + fl.length);

  friends = [];
  for(i = 0; i < fl.length; i++) {
    blid = fl[i];
    console.log(blid);
    us = Users.getByBlid(blid);

    obj = {
      "blid": blid,
      "username": us.getUsername(),
      "online": us.isOnline()
    };
    friends.push(obj);
  }

  dat = {
    "type": "friendsList",
    "friends": friends
  };
  console.log(JSON.stringify(dat));
  this.con.write(JSON.stringify(dat) + '\r\n');
}

Client.prototype.sendFriendRequests = function () {
  user = Users.getByBlid(this.blid);
  fl = user.getFriendRequests();
  friends = [];
  for(i = 0; i < fl.length; i++) {
    blid = fl[i];
    us = Users.getByBlid(blid);

    obj = {
      "blid": blid,
      "username": us.getUsername()
    };
    friends.push(obj);
  }

  dat = {
    "type": "friendRequests",
    "requests": friends
  };
  console.log(JSON.stringify(dat));
  this.con.write(JSON.stringify(dat) + '\r\n');
}

Client.prototype.sendRaw = function (dat) {
  this.con.write(JSON.stringify(dat) + '\r\n');
}

Client.prototype.cleanUp = function () {
  user = Users.getByBlid(this.blid);
  user.removeClient(this);

  for(i = 0; i < this.rooms.length; i++) {
    this.rooms[i].removeUser(this, 1);
  }
}

Client.prototype._addToRoom = function (g) {
  this.rooms.push(g);
}
