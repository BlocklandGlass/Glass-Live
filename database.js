const MongoClient = require('mongodb').MongoClient;

const assert = require('assert');
const request = require('request');

const logger = require('./logger');

const Config = require('./config');
if(Config.mongoUsername == null || Config.mongoPassword == null) {
  if(Config.username == null || Config.password == null) {
    console.log('config needs MongoDb auth');
    process.exit(1);
    return;
  }
}

var getUsername = function(blid, cb) {
  getUserData(blid, function(data, err) {
    if(err != null) {
      cb(null, err);
    } else {
      cb(data.username, null);
    }
  })
}

var getUserData = function(blid, callback) {
  if(module.userData == null) {
    module.userData = {};
  }

  if(module.loadCallbacks == null) {
    module.loadCallbacks = [];
  }

  if(module.userData[blid] != undefined) { // desync problems? TODO
    //logger.log("Loaded " + blid + " from memory");
    callback(module.userData[blid], null);
  } else {
    if(module.loadCallbacks[blid] == null) {
      module.loadCallbacks[blid] = [callback];
      //logger.log("Loading " + blid + " from database");
      _loadUserData(blid);
    } else {
      //logger.log("Added another callback to load " + blid + " from database");
      module.loadCallbacks[blid].push(callback);
    }
  }
}

var _loadUserData = function(id) {
  var blid = id;

  if(Config.username != null || Config.password != null) {
    var user = Config.username;
    var pass = Config.password;

    var srv = 'mongodb://' + user + ':' + pass + '@blocklandglass.com:27017/glassLive';
  } else {
    var user = Config.mongoUsername;
    var pass = Config.mongoPassword;
    var url = Config.mongoURL;

    var srv = 'mongodb://' + user + ':' + pass + '@' + url;
  }

  MongoClient.connect(srv, function(err, client) {
    if(err != null) {
      logger.error('Database error getting ' + blid);
      logger.error(err);
      var callbacks = module.loadCallbacks[blid];
      for(var i in callbacks) {
        var cb = callbacks[i];
        if(typeof cb === "function")
          cb(null, 'Failed to connect');
      }
      module.loadCallbacks[blid] = null;
      client.close();
      return;
    }

    const db = client.db('glassLive');

    db.collection('users').findOne({"blid":blid}, function(err, data) {
      assert.equal(null, err);

      if(data == null || data.data == null) {
        data = _createNewData(blid);
      }

      module.userData[blid] = data.data;

      var callbacks = module.loadCallbacks[blid];
      for(var i in callbacks) {
        var cb = callbacks[i];
        if(typeof cb === "function")
          cb(data.data, null);
      }

      module.loadCallbacks[blid] = null;
    });
    client.close();
  });
}

var saveUserData = function(blid, data, callback) {
  if(module.userData[blid] == null) {
    //we haven't loaded! we shouldnt be saving
    logger.error('saveUserData: Attempted to save for ' + blid + ', but data wasn\'t loaded!');
    return;
  }

  if(callback == null)
    callback = function(err){ if(err!=null) { logger.error("Save error: " + err); } };

  module.userData[blid] = data;

  if(Config.username != null || Config.password != null) {
    var user = Config.username;
    var pass = Config.password;

    var srv = 'mongodb://' + user + ':' + pass + '@blocklandglass.com:27017/glassLive';
  } else {
    var user = Config.mongoUsername;
    var pass = Config.mongoPassword;
    var url = Config.mongoURL;

    var srv = 'mongodb://' + user + ':' + pass + '@' + url;
  }

  MongoClient.connect(srv, function(err, client) {
    if(err != null) {
      callback(err);
      return;
    }

    const db = client.db('glassLive');

    db.collection('users').updateOne({"blid": blid}, {$set: {"blid": blid, "data": data}}, {upsert: true}, function(err, result) {
      if(err != null) {
        callback(err);
        return;
      }
      callback(null);
    });
    client.close();
  });
}

var _createNewData = function(blid) {
  return {
    blid: blid,
    data: {
      friends: [],
      requests: [],
      blocked: [],
      username: null
    }
  };
}

module.exports = {getUserData, getUsername, saveUserData};
