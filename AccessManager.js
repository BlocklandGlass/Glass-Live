const fs = require('fs');
const logger = require('./logger');
const moment = require('moment');

//================================================================
// save/load
//================================================================

var loadData = function() {
  if(module.didLoad) return;

  try {
    fs.statSync('save/access.json');
    var obj = require('save/access.json');
    module.persist = obj;
    module.didLoad = true;
  } catch(e) {
    logger.log("Error loading access list, starting new");
    module.persist = {
      banned: {},
      muted: {}
    };
  }
}

var saveData = function() {
  if(!module.didLoad) return;

  try {
    fs.writeFileSync('save/access.json', JSON.stringify(module.persist));
  } catch(e) {
    logger.error("Error saving access.json", e);
  }
}

//================================================================
// administration
//================================================================

var getBanList = function() {
  return module.persist.banned;
}

var getMuteList = function() {
  return module.persist.muted;
}

var getBan = function(id) {
  return module.persist.banned[id];
}

var ban(blid, duration, reason) {
  if(reason == "" || reason == null) {
    reason = "unspecified";
  }

  var banObj = {
    "blid": blid,
    "duration": duration,
    "reason": reason,
    "time": moment()
  }

  logger.log("BL_ID " + blid + " banned for " + duration + ' seconds, "' + reason + '"');

  module.persist.banned[blid] = banObj;
  saveData();
}

var mute(blid, duration, reason) {
  if(reason == "" || reason == null) {
    reason = "unspecified";
  }

  var muteObj = {
    "blid": blid,
    "duration": duration,
    "reason": reason,
    "time": moment()
  }

  logger.log("BL_ID " + blid + " muted for " + duration + ' seconds, "' + reason + '"');

  module.persist.banned[blid] = banObj;
  saveData();
}

var isBanned(blid) {
  var banObj = module.persist.banned[blid];
  if(banObj == null) {
    return false;
  }

  var timeSince = moment().diff(banObj.time, 'seconds');
  if(timeSince >= banObj.duration) {
    module.persist.banned[blid] = undefined;
    saveData();
    return false;
  } else {
    return true;
  }
}

var isMute(blid) {
  var muteObj = module.persist.muted[blid];
  if(muteObj == null) {
    return false;
  }

  var timeSince = moment().diff(muteObj.time, 'seconds');
  if(timeSince >= muteObj.duration) {
    module.persist.muted[blid] = undefined;
    saveData();
    return false;
  } else {
    return true;
  }
}

loadData();

module.exports = {getBanList, getMuteList, ban, getBan, mute, isBanned, isMute};
