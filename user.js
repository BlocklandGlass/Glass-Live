// whereas client manages an individual connection,
// user deals with longer term data

const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

module.users = [];

/*
Users.get('9789', function(user) {

});
*/

var get = function get(blid, callback) {
  if(module.users[blid] != null) {
    console.log("user " + blid + " already exists");
    callback(module.users[blid]);
  } else {
    var url = 'mongodb://localhost:27017/glassLive';
    MongoClient.connect(url, function(err, db) {
      assert.equal(null, err);
      db.collection('users').findOne({"blid":blid}, function(err, data) {
        callback(new User(data, blid));
      }.bind({blid: blid, callback: callback}));
      db.close();
    }.bind({blid: blid, callback: callback}));
  }
}

var getByBlid = function getByBlid(blid) {
  if(users[blid] != null) {
    return users[blid];
  } else {
    return new User(blid);
  }
}

function User(data, blid) {
  if(data == null || data._longTerm == null) {
    this._longTerm = {};
    this._longTerm.requests = [];
    this._longTerm.friends = [];
    this._dbId = null;
  } else {
    this._longTerm = data.data;
    this._dbId = data._id;
  }

  this.blid = blid;
  this.clients = [];

  module.users[blid] = this;

  console.log("[debug] inited " + blid);
  console.log(data);
}

User.prototype.save = function() {
  var url = 'mongodb://localhost:27017/glassLive';
  var user = this;
  MongoClient.connect(url, function(err, db) {
    assert.equal(null, err);
    db.collection('users').save( {
        "_id": user._dbId,
        "blid": user.blid,
        "data": user._longTerm
     }, function(err, result) {
      assert.equal(err, null);
      console.log("Saved user " + user.blid);
      console.log(user._longTerm)
    }.bind({user: user}));
    db.close();
  }.bind({user: user}));

}

User.prototype.newFriendRequest = function(sender) {
  if(this._longTerm.requests.indexOf(sender.blid) == -1) {
    this._longTerm.requests.push(sender.blid);
  }

  console.log("new friend request from " + sender.blid);

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
    get(blid, function(user) {
      idx = this._longTerm.requests.indexOf(blid);
      this._longTerm.requests.splice(idx, 1);

      if(this._longTerm.friends.indexOf(blid) > -1)
        return;

      this.addFriend(blid, 1);
      user.addFriend(this.blid, 0);
    });
  }
};

User.prototype.declineFriend = function (blid) {
  if(this._longTerm.requests.indexOf(blid) > -1) {

    idx = this._longTerm.requests.indexOf(blid);
    this._longTerm.requests.splice(idx, 1);

  }
};

User.prototype.addFriend = function(blid, accepter) {
  get(blid, function(u) {
    dat = {
      "type": "friendAdd",
      "blid": blid,
      "username": u.getUsername(),
      "accepter": accepter,
      "online": u.isOnline()
    };
    this.messageClients(JSON.stringify(dat));

    if(this._longTerm.friends == null)
      this._longTerm.friends = [];

    if(this._longTerm.friends.indexOf(blid) == -1) {
      this._longTerm.friends.push(blid);
    }

    this.save();
  }.bind({this: this, blid: blid, accepter: accepter}));
}

User.prototype.getFriendsList = function() {
  if(this._longTerm.friends == null)
    this._longTerm.friends = [];

  return this._longTerm.friends;
}

User.prototype.getFriendRequests = function() {
  if(this._longTerm.requests == null)
    this._longTerm.requests = [];

  return this._longTerm.requests;
}

User.prototype.messageFriends = function(msg) {
  friends = this.getFriendsList();
  for(var i = 0; i < friends.length; i++) {
    friend_blid = friends[i];
    get(friend_blid, function(user) {
      user.messageClients(msg)
    });
  }
}

User.prototype.addClient = function(client) {
  if(this.clients.length == 0) {
    dat = {
      "type": "friendStatus",
      "online": "1",
      "blid": this.blid
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
      "online": "0",
      "blid": this.blid
    };
    this.messageFriends(JSON.stringify(dat));
  }
}

User.prototype.isOnline = function() {
  return this.clients.length > 0;
}

User.prototype.getUsername = function() {
  return this._longTerm.username;
}

User.prototype.setUsername = function(usr) {
  this._longTerm.username = usr;
  this.save();
}

User.prototype.messageClients = function (msg) {
  for(var i = 0; i < this.clients.length; i++) {
    cl = this.clients[i];
    cl.con.write(msg + '\r\n');
  }
}

module.exports = {getByBlid: getByBlid, get: get};
