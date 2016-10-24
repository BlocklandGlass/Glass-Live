const MongoClient = require('mongodb').MongoClient;

const assert = require('assert');
const request = require('request');

const logger = require('./logger');

var getUsername = function(blid, cb) {
  getUserData(blid, function(data, err) {
    if(err != null) {
      cb(null, err);
    } else {
      cb(data.data.username, null);
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
    logger.log("Loaded " + blid + " from memory");
    callback(module.userData[blid], null);
  } else {
    if(module.loadCallbacks[blid] == null) {
      module.loadCallbacks[blid] = [callback];
      logger.log("Loading " + blid + " from database");
      _loadUserData(blid);
    } else {
      logger.log("Added another callback to load " + blid + " from database");
      module.loadCallbacks[blid].push(callback);
    }
  }
}

var _loadUserData = function(id) {
  var blid = id;
  var url = 'mongodb://blocklandglass.com:27017/glassLive';
  MongoClient.connect(url, function(err, db) {

    if(err != null) {
      logger.error('Database error getting ' + blid);
      logger.error(err);
      var callbacks = module.loadCallbacks[blid];
      for(i in callbacks) {
        var cb = callbacks[i];
        if(typeof cb === "function")
          cb(null, 'Failed to connect');
      }
      module.loadCallbacks[blid] = null;
      return;
    }

    db.collection('users').findOne({"blid":blid}, function(err, data) {
      assert.equal(null, err);

      var user = data;

      var callbacks = module.loadCallbacks[blid];
      for(i in callbacks) {
        var cb = callbacks[i];
        if(typeof cb === "function")
          cb(user, null);
      }

      module.loadCallbacks[blid] = null;
    });
    db.close();
  });
}

module.exports = {getUserData, getUsername};
