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
  var req = request('GET', "http://" + config.authenticator + "/api/2/authCheck.php?ident=" + ident)

  res = JSON.parse(req.getBody());

  if(res.status == "success") {
    this.blid = res.blid;
    this.username = res.username;
    this.admin = res.admin;
    this.mod = res.mod;
    return true;
  } else {
    return false;
  }
};

Client.prototype.disconnect = function(reason) {
  if(reason == null) {
    reason = -1;
  }

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
  friends = [];
  for(i = 0; i < fl.length; i++) {
    blid = fl[i];
    un = Users.getByBlid(fl).getUsername();

    obj = {
      "blid": blid,
      "username": un,
      "status": 1
    };
    friends.push(obj);
  }

  dat = {
    "type": "friendsList",
    "friends": friends
  };
  this.con.write(JSON.stringify(dat) + '\r\n');
}

Client.prototype.cleanUp = function () {
  user = Users.getByBlid(this.blid);
  user.removeClient(this);

  for(i = 0; i < this.rooms.length; i++) {
    this.rooms[i].removeUser(this, 0);
  }
}

Client.prototype._addToRoom = function (g) {
  this.rooms.push(g);
}
