// whereas client manages an individual connection,
// user deals with longer term data

var users = [];
var uid = 0;

var getByBlid = function getByBlid(blid) {
  if(users[blid] != null) {
    return users[blid];
  } else {
    return new User(blid);
  }
}

function User(blid) {
  fs = require('fs');
  try {
    fs.statSync('./save/' + blid + '.json')
    this._longTerm = require('./save/' + blid + '.json');
  } catch (e) {
    this._longTerm = {};
    this._longTerm.requests = [];
    this._longTerm.friends = [];
  }

  this.uid = uid;
  uid++;

  this.blid = blid;
  this.clients = [];

  users[blid] = this;
}

User.prototype.save = function() {
  fs = require('fs');
  fs.writeFile('./save/' + this.blid + '.json', JSON.stringify(this._longTerm));
}

User.prototype.newFriendRequest = function(sender) {
  if(this._longTerm.requests.indexOf(sender.blid) == -1) {
    this._longTerm.requests.push(sender.blid);
  }

  dat = {
    "type": "friendRequest",
    "sender": sender.getUsername(),
    "sender_blid": sender.blid
  };
  this.messageClients(JSON.stringify(dat));

  this.save();
}

User.prototype.acceptFriend = function (blid) {
  if(this._longTerm.requests.indexOf(blid) == -1) {
    dat = {
      "type": "messageBox",
      "title": "Uh oh",
      "text": "You don't have a friend request from that person!"
    };
    this.messageClients(JSON.stringify(dat));
  } else {
    user = getByBlid(blid);

    idx = this._longTerm.requests.indexOf(blid);
    this._longTerm.requests.splice(idx, 1);

    this.addFriend(blid, 1);
    user.addFriend(this.blid, 0);
  }
};

User.prototype.addFriend = function(blid, accepter) {
  u = getByBlid(blid);
  dat = {
    "type": "friendAdd",
    "blid": blid,
    "username": u.getUsername(),
    "accepter": accepter
  };
  this.messageClients(JSON.stringify(dat));

  if(this._longTerm.friends == null)
    this._longTerm.friends = [];

  if(this._longTerm.friends.indexOf(blid) == -1) {
    this._longTerm.friends.push(blid);
  }

  this.save();
}

User.prototype.getFriendsList = function() {
  if(this._longTerm.friends == null)
    this._longTerm.friends = [];

  return this._longTerm.friends;
}

User.prototype.messageFriends = function(msg) {
  friends = this.getFriendsList();
  for(i = 0; i < friends.length; i++) {
    friend_blid = friends[i];
    user = getByBlid(friend_blid);
    user.messageClients(msg)
  }
}

User.prototype.addClient = function(client) {
  if(this.clients.length == 0) {
    dat = {
      "type": "friendStatus",
      "status": "online",
      "blid": this.blid;
    };
    this.messageFriends(JSON.stringify(dat));
  }
  this.clients.push(client);
}

User.prototype.removeClient = function (c) {
  idx = this.clients.indexOf(c);
  if(idx > -1) {
    this.clients.splice(idx, 1);
  } else {
    return;
  }

  if(this.clients.length == 0) {
    dat = {
      "type": "friendStatus",
      "status": "offline",
      "blid": this.blid;
    };
    this.messageFriends(JSON.stringify(dat));
  }
}

User.prototype.getUsername = function() {
  return this._longTerm.username;
}

User.prototype.setUsername = function(usr) {
  this._longTerm.username = usr;
  this.save();
}

User.prototype.messageClients = function (msg) {
  for(i = 0; i < this.clients.length; i++) {
    cl = this.clients[i];
    cl.con.write(msg + '\r\n');
  }
}

module.exports = {getByBlid: getByBlid};
