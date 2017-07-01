const moment = require('moment');

var getAll = function() {
  if(module.permission == null)
    module.permission = {};

  var perms = [];
  for(var perm in module.permission) {
    perms.push(perm);
  }
  return perms;
}

var createSet = function(persist) {
  if(persist == null)
    persist = {};

  return new PermissionSet(persist);
}

function Permission(name, desc, isDefault) {
  this.name = name;
  this.desc = desc;
  this.default = (isDefault == true);

  if(module.permission == null)
    module.permission = {};

  module.permission[name] = this;
}

function PermissionSet(data) { //this is from clientConnection.persist.permissions
  /*
  {
    "rooms.join": true,
    "message.friends": false
  }
  */
  this.perms = data.permissions;

  if(this.perms == null)
    this.perms = {};

  /*
  {
    "rooms.join": {
      value: false,
      startTime: (timestamp),
      duration: 3600, //seconds
      reason: "You're banned!"
    }
  }
  */
  this.temp = data.tempPermissions;

  if(this.temp == null)
    this.temp = {};

  this.checkTemps();
}

var loadPermissions = function() {
  if(module.loadedPermissions)
    return;

  new Permission('service_use', "Can use live", true); // barred

  new Permission('rooms_join', "Can join rooms freely", true); //banned
  new Permission('rooms_talk', "Can talk in rooms", true);

  new Permission('message_public', "Can message anyone", true);
  new Permission('message_friends', "Can message friends", true);

  new Permission('friends_request', "Can send friend requests", true);
}

PermissionSet.prototype.hasPermission = function(perm) {
  var set = this;
  var tempData = set.getTempData(perm);
  if(tempData != false) {
    return tempData.value;
  }

  if(set.perms[perm] != null) {
    return set.perms[perm];
  }

  if(module.permission[perm] != null) {
    return module.permission[perm].default;
  }

  return false;
}

PermissionSet.prototype.isTempPermission = function(perm) {
  var set = this;
  var tempData = set.getTempData(perm);

  if(tempData != false) {
    return true;
  }

  return false;
}

PermissionSet.prototype.getTempData = function(perm) {
  var set = this;
  set.checkTemps();

  if(set.temp[perm] != null) {
    return set.temp[perm];
  }

  return false;
}

PermissionSet.prototype.checkTemps = function() {
  var set = this;

  var temps = set.temp;
  for(var perm in temps) {
    var obj = temps[perm];
    if(moment().diff(moment.unix(obj.startTime), 'seconds') > obj.duration) {
      //expired
      delete set.temp[perm];
    }
  }
}

PermissionSet.prototype.newTempPermission = function(perm, value, duration, reason) {
  var set = this;
  duration = parseInt(duration);
  if(duration < 0 || duration == NaN)
    duration = 0;

  set.temp[perm] = {
    value: value,
    startTime: moment().unix(),
    duration: duration, //seconds
    reason: reason
  };
}

loadPermissions();
module.exports = {createSet, getAll};
