const moment = require('moment');
const logging = require('./dataLogging');
const logger = require('./logger');

/*
module.greetings = [
  "That's me!",
  "How's it going?",
  "Hello!",
  "Yes?"
];
*/

// no need to add plurals here, they are handled automatically
module._racialSlurs = [
  "nigger",
  "niggers",
  "nig",
  "niga",
  "nigg",
  "nigga",
  "nigor",
  "nigre",
  "nigar",
  "niggur",
  "niggar",
  "nigette",
  "niggerfaggot",
  "wigger",
  "beaner",
  "faget",
  "fagit",
  "fagot",
  "faggit",
  "fagget",
  "faggot",
  "faggits",
  "faggets",
  "faggots",
  "fagg",
  "fag",
  "fags",
  "sandnigger",
  "sandniggar",
  "sandnig",
  "spic",
  "kike",
  "coon",
  "coonass",
  "chink",
  "polack",
  "niglet",
  "nignog",
  "tarbaby",
  "paki",
  "gook",
  "wetback"
]

var _percentUpper = function(str) {
  var compMessage = str.replace(/[^A-Za-z]+/g," ").trim();

  var upperCt = 0;
  for(var i = 0; i < compMessage.length; i++) {
    var char = compMessage.charAt(i);
    if(char.toUpperCase() == char) {
      upperCt++;
    }
  }

  if(compMessage.length > 0) {
    return upperCt/compMessage.length;
  } else {
    return 0;
  }
}

var _percentDiscrimination = function(word) {
  var str = word.toLowerCase().replace(/[^A-Za-z]+/g,"");
  var highPct = 0;

  for(var i in module._racialSlurs) {
    var slur = module._racialSlurs[i];
    if(str.indexOf(slur) == 0) {
      var pct = slur.length/str.length;
      if(pct > highPct) {
        highPct = pct;
      }
    }

    // note: using "es" will get people banned for words such as "spicES" - do not want another spicy incident again

    var plurals = [
      "s",
      "'s",
      "z",
      "'z"
    ];

    for(var i in plurals) {
      var pslur = slur+plurals[i];
      if(str.indexOf(pslur) == 0) {
        var pct = pslur.length/str.length;
        if(pct > highPct) {
          highPct = pct;
        }
      }
    }
  }

  return highPct;
}

var filterString = function(str) {
  var words = str.split(' ');
  var str = "";
  for(var i in words) {
    var word = words[i];

    var highPct = _percentDiscrimination(word);

    if(highPct > 0.90) {
      for(var i = 0; i < word.length; i++) {
        str += "*";
      }
    } else {
      str += word;
    }
    str += " ";
  }

  str.trim();
  return str;
}

var onRoomMessage = function(room, sender, message) {
  if(sender.roomMessageHistory == null)
    sender.roomMessageHistory = [];

  if(sender.isMod || sender.isAdmin)
    return;

  checkMessageHistory(sender, message, room);

  sender.roomMessageHistory.push({
    time: moment().unix(),
    message: message,
    room: room.id
  });

  if(sender.roomMessageHistory.length > 100)
    sender.roomMessageHistory.splice(0, sender.roomMessageHistory.length-100);


  // var alphaOnly = message.replace(/[^A-Za-z]+/g," ").trim();

  // if(_percentUpper(message) >= 0.75 && alphaOnly.length > 5) {
    // sendRoomMessage(room, "Don't use all caps.");
    // issueWarning(sender, 1, room);
  // }

  var didDisc = false;
  var didLength = false;
  var words = message.toLowerCase().split(/ /g);
  for(var i in words) {
    var word = words[i];
    /*
    if(word == "@glassbot") {
      if(module._lastHello == null || moment().diff(moment.unix(module._lastHello), 'seconds') > 45) {
        sendRoomMessage(room, module.greetings[Math.floor(Math.random() * module.greetings.length)]);
        module._lastHello = moment().unix();
      }
    }
    */

    // use strpos?
    word.trim();
    /*if(word.length > 0 && _percentDiscrimination(word) >= 0.90 && !didDisc) {
      didDisc = true;
      sendRoomMessage(room, "Discrimination is not welcome here. (" + word + ")");

      setTimeout(()=>{
        room.sendObject({
          type: 'roomText',
          id: room.id,
          text: '<color:9b59b6> * GlassBot banned ' + sender.username + ' (' + sender.blid + ') from public rooms for ' +  15 + ' minutes'
        });
        doRoomsBan(sender, 60*15, "Discrimination: " + word)
      }, 1100);
    }*/

    if(word.length > 35 && !didLength && word.indexOf("http://") != 0 && word.indexOf("https://") != 0 && word.indexOf("glass://") != 0) {
      didLength = true;
      sendRoomMessage(room, "Please use real words.");
      issueWarning(sender, 1, room);
    }
  }
}

var sendRoomMessage = function(room, message) {
  if(room == null)
    return;

  room.sendObject({
    type: "roomMessage",
    room: room.id,

    sender: "GlassBot",
    sender_id: -1,

    msg: message,

    timestamp: moment().unix(),
    datetime: moment().format('h:mm:ss a')
  });
}

var sendDirectMessage = function(cl, message, room) {
  /*cl.sendDirectMessage(
    {
      username: "GlassBot",
      blid: 10
    },
    message
  );*/
  cl.sendObject({
    type: "roomMessage",
    room: room.id,

    sender: "GlassBot",
    sender_id: -1,

    msg: message,

    timestamp: moment().unix(),
    datetime: moment().format('h:mm:ss a')
  });
}

var checkMessageHistory = function(sender, message, room) {
  var hist = sender.roomMessageHistory.slice(0).reverse();

  if(hist[4] != null) {
    if(moment().diff(moment.unix(hist[4].time), 'seconds') < 5) {
      sendRoomMessage(room, "Slow down, don't spam.");
      issueWarning(sender, 1, room);
    }
  }

  var repCount = 0;
  for(var i = 0; i < Math.min(5, hist.length); i++) {
    var msgObj = hist[i];

    if(moment().diff(moment.unix(msgObj.time), 'seconds') > 60)
      break; //anything older than a minute can't be too spammy

    if(msgObj.message == message) {
      repCount++;
    }

    if(repCount >= 2) {
      sendRoomMessage(room, "Don't spam.");
      issueWarning(sender, 1, room);
      break;
    }
  }
}

var doRoomsBan = function(client, duration, reason) {
  client.roomBan(duration, reason);

  logging.logGlobalRoomEvent('bot', "Banned " + client.username + " (" + client.blid + ")");
}

var doKick = function(cl, reason, room) {
  if(room != null) {
    room.sendObject({
      type: 'roomText',
      id: room.id,
      text: "<color:9b59b6> * GlassBot kicked " + cl.username + " (" + cl.blid + ")"
    })

    logging.logRoomEvent(room.id, 'bot', "Kicked " + cl.username + " (" + cl.blid + ")");
  }
  cl.kick(reason);
}

var doMute = function(cl, duration, room) {
  cl.setTempPerm('rooms_talk', false, duration, "You're muted!");

  cl._notifyIconChange("sound_mute");

  setTimeout(function() {
    cl._notifyIconChange();
    cl.sendObject({
      type: 'roomText',
      id: room.id,
      text: ' * Your mute has expired'
    })
  }, duration*1000);

  var strDur = "";
  if(duration > 60) {
    strDur = Math.floor(duration/60) + " minutes";
  } else {
    strDur = duration + " seconds";
  }

  //if(duration > 5) {
    room.sendObject({
      type: 'roomText',
      id: room.id,
      text: "<color:9b59b6> * GlassBot has muted " + cl.username + " (" + cl.blid + ") for " + strDur
    })

    logging.logRoomEvent(room.id, 'bot', "Muted " + cl.username + " (" + cl.blid + ") for " + strDur);
  //}
}

var issueWarning = function(client, amt, room) {
  if(client.persist.warnings == null)
    client.persist.warnings = 0;

  client.persist.warnings += amt;
  client.savePersist();

  var warnings = client.persist.warnings;

  /*
  if(room != null) {
    room.sendObject({
      type: 'roomText',
      id: room.id,
      text: '<color:9b59b6> * ' + client.username + ' now has ' + warnings + ' ' + (warnings == 1 ? 'warning' : 'warnings')
    });
  }
  */

  if(room != null) {
    client.sendObject({
      type: 'roomText',
      id: room.id,
      text: '<color:e74c3c> * You now have ' + warnings + ' temporary ' + (warnings == 1 ? 'warning' : 'warnings')
    });
  }

  logging.logRoomEvent(room.id, 'bot', "Issued a warning to " + client.username + " (" + client.blid + ")");

  _warningPunishment(client, warnings, room);
}

var _warningPunishment = function(client, amt, room) {
  if(amt == 1) {
    doMute(client, 10, room);
  }

  if(amt == 2) {
    doMute(client, 60, room);
  }

  if(amt == 3) {
    doMute(client, 300, room);
    doKick(client, "You've reached 3 warnings.", room);
  }

  if(amt == 4) {
    doMute(client, 600, room);
    doKick(client, "You've reached 4 warnings.", room);
  }

  if(amt >= 5) {
    doRoomsBan(client, 60*Math.pow(5, amt-4), "Greater than 4 warnings issued.");
  }
}

module.exports = {onRoomMessage, sendRoomMessage, filterString};
