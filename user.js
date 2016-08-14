// whereas client manages an individual connection,
// user deals with longer term data

const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const request = require('request');
const cheerio = require('cheerio');

module.users = [];
module.usersLoading = [];
module.userLoadCallbacks = [];
/*
Users.get('9789', function(user) {

});
*/

var get = function get(blid, callback) {
  if(blid == undefined || blid == null) {
    return;
  }

  if(module.users[blid] != null) {
    callback(module.users[blid]);
  } else {
    if(module.usersLoading[blid]) {
      console.log("[ warn] prevented async duplicate");
      module.userLoadCallbacks[blid].push(callback);
      return;
    } else {
      module.userLoadCallbacks[blid] = [callback];
      module.usersLoading[blid] = true;
    }

    var url = 'mongodb://localhost:27017/glassLive';
    MongoClient.connect(url, function(err, db) {
      assert.equal(null, err);
      db.collection('users').findOne({"blid":blid}, function(err, data) {
        assert.equal(null, err);
        var user = new User(data, blid);
        var callbacks = module.userLoadCallbacks[blid];
        console.log("[debug] callbacks: " + (callbacks.length));
        for(var i = 0; i < callbacks.length; i++) {
          cb = callbacks[i];
          if(typeof cb === "function")
            cb(user);
        }
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
  if(module.users[blid] != null) {
    console.log("[error] async duplicate user")
    return module.users[blid];
  }

  this.blid = blid;
  this.clients = [];

  if(data == null || data.data == null) {
    this._longTerm = {};
    this._longTerm.requests = [];
    this._longTerm.friends = [];
    this.initialized = true;

    console.log("[debug] creating " + blid);
    this.save();
  } else {
    this._longTerm = data.data;
    this.initialized = true;

    console.log("[debug] found " + blid);
  }

  module.users[blid] = this;

  console.log("[debug] loaded " + blid);
}

User.prototype.save = function() {
  if(this.initialized != true) {
    throw "could not save uninitialized user";
    return;
  }

  var url = 'mongodb://localhost:27017/glassLive';
  var user = this;
  MongoClient.connect(url, function(err, db) {
    assert.equal(null, err);

    if(user.blid == null) {
      console.error("Null BLID");
      return;
    }

    var blid = user.blid;
    var data = user._longTerm;

    db.collection('users').update({"blid": blid}, {"blid": blid, "data": data}, {upsert: true}, function(err, result) {
      if(err != null) {
        console.log("error:" + err);
      }
      assert.equal(err, null);
      console.log("[debug] Updated " + user.blid);
    }.bind({user: user}));
    db.close();
  }.bind({user: user}));

}

User.prototype.newFriendRequest = function(sender) {
  if(this._longTerm.requests.indexOf(sender.blid) == -1) {
    this._longTerm.requests.push(sender.blid);
  }

  dat = {
    "type": "friendRequest",
    "sender": sender.username,
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
    var me = this;
    get(blid, function(user) {
      idx = me._longTerm.requests.indexOf(blid);
      me._longTerm.requests.splice(idx, 1);

      if(me._longTerm.friends.indexOf(blid) > -1)
        return;

      me.addFriend(blid, 1);
      user.addFriend(me.blid, 0);
    }.bind({me: me}));
  }
};

User.prototype.declineFriend = function (blid) {
  if(this._longTerm.requests.indexOf(blid) > -1) {

    idx = this._longTerm.requests.indexOf(blid);
    this._longTerm.requests.splice(idx, 1);

  }
};

User.prototype.addFriend = function(blid, accepter) {
  var us = this
  get(blid, function(u) {
    dat = {
      "type": "friendAdd",
      "blid": blid,
      "username": u.getUsername(),
      "accepter": accepter,
      "online": u.isOnline()
    };
    us.messageClients(JSON.stringify(dat));

    if(us._longTerm.friends == null)
      us._longTerm.friends = [];

    if(us._longTerm.friends.indexOf(blid) == -1) {
      us._longTerm.friends.push(blid);
    }

    us.save();
  }.bind({us: us, blid: blid, accepter: accepter}));
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

  if(c.isPrimary)
    this._primaryClient = null;

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
    cl.write(msg);
  }
}

User.prototype.messagePrimary = function (msg) {
  var prim = this.getPrimaryClient();
  if(prim != false)
    prim.write(msg);
  else
    console.log("can't find primary client");
}

User.prototype.getPrimaryClient = function () {
  if(this._primaryClient != null)
    return this._primaryClient;
  else {
    console.log("no primary client");
    return false;
  }
}

User.prototype.setPrimaryClient = function (client) {
  console.log("setPrimaryClient");
  //todo inform old client
  this._primaryClient = client;
  client.isPrimary = true;
}

User.prototype.generateUserData = function () {
  /*data = {
    "blid":
    "username":
    "location":
    "forumId"
  }*/
}

User.prototype.addForumId = function (id, callback) {
  var user = this;
  url = 'https://forum.blockland.us/index.php?action=profile;u=' + id + ';wap';
  request(url, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var $ = cheerio.load(body);
      var rows = $('.windowbg').find('tr');

      for(var i = 0; i < rows.length; i++) {
        row = $(rows[i]);

        var children = row.children('td')
        if(children.length >= 2) {
          key = $(children[0]).text()
          val = $(children[1]).text()

          key = key.replace(":", "").trim();

          console.log("[" + key + "] [" + val + "]");
          if(key == "Blockland ID") {
            if(val == user.blid) {
              user._longTerm.forumId = id;
              user.save();
              console.log("forumId confirmed");
            } else {
              console.log("not your account");
            }
          }
        }
      }
    } else {
      callback(false);
    }
  }.bind({user: user, callback: callback, id: id}));
}

module.exports = {getByBlid: getByBlid, get: get};
