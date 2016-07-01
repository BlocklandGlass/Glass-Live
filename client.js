module.exports = Client;

const Users = require('./user');
const config = require('./config');


connections = 0;

function Client(con) {
  this.con = con;
  this.cid = connections;

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
    return true;
  } else {
    return false;
  }
};

Client.prototype.setLocation = function (act, loc) {
  this.activity = act;

  if(act == "playing") {
    this.location = loc;
  } else {
    this.location = "";
  }
};

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
