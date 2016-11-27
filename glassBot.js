const moment = require('moment');

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
  "nigger-faggot",
  "wigger",
  "beaner",
  "faget",
  "fagit",
  "fagot",
  "faggit",
  "fagget",
  "faggot",
  "fagg",
  "fag",
  "sand-nigger",
  "sandnigger",
  "sand-niggar",
  "sand-nig",
  "sandniggar",
  "sandnig",
  "spic",
  "kike",
  "coon",
  "coonass",
  "chink",
  "cracker",
  "polack",
  "niglet",
  "nig-let",
  "nignog",
  "nig-nog",
  "nognig",
  "nog-nig",
  "hillbilly",
  "redneck",
  "tarbaby",
  "tar-baby",
  "pikey",
  "paki"
]

var _percentUpper = function(str) {
  var compMessage = str.replace(/[^A-Za-z]+/g," ");
  var upperCt = 0;
  for(var i = 0; i < compMessage.length; i++) {
    var char = compMessage.charAt(i);
    if(char.toUpperCase() == char) {
      upperCt++;
    }
  }

  return upperCt/compMessage.length;
}

var _percentDiscrimination = function(word) {
  var str = word.toLowerCase();
  var highPct = 0;

  for(i in module._racialSlurs) {
    var slur = module._racialSlurs[i];
    if(str.indexOf(slur) == 0) {
      var pct = slur.length/str.length;
      if(pct > highPct) {
        highPct = pct;
      }
    }
  }

  return highPct;
}

var onRoomMessage = function(room, sender, message) {
  if(sender.roomMessageHistory == null)
    sender.roomMessageHistory = [];

  checkMessageHistory(sender, message, room);

  sender.roomMessageHistory.push({
    time: moment().unix(),
    message: message,
    room: room.id
  });

  if(sender.roomMessageHistory.length > 100)
    sender.roomMessageHistory.splice(0, sender.roomMessageHistory.length-100);

  if(_percentUpper(message) >= 0.75 && message.length > 5) {
    sendRoomMessage(room, "No yelling, please.");
    issueWarning(sender, 1, room);
  }

  var didDisc = false;
  var words = message.toLowerCase().split(/ /g);
  for(i in words) {
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
    if(word.length > 0 && _percentDiscrimination(word) >= 0.90 && !didDisc) {
      didDisc = true;
      sendRoomMessage(room, "Discrimination is not welcome here. (" + word + ")");

      setTimeout(()=>{
        room.sendObject({
          type: 'roomText',
          id: room.id,
          text: '<color:9b59b6> * GlassBot banned ' + sender.username + ' (' + sender.blid + ') from public rooms for ' +  60*5 + ' seconds'
        });
        doRoomsBan(sender, 60*5, "Discimination: " + word)
      }, 1100);
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

var checkMessageHistory = function(sender, message, room) {
  var hist = sender.roomMessageHistory.slice(0).reverse();

  if(hist[4] != null) {
    if(moment().diff(moment.unix(hist[4].time), 'seconds') < 5) {
      sendRoomMessage(room, "Slow down.");
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
      sendRoomMessage(room, "Don't repeat yourself so often.");
      issueWarning(sender, 1, room);
      break;
    }
  }
}

var doRoomsBan = function(client, duration, reason) {
  client.roomBan(duration, reason);
}

var doMute = function(cl, duration, room) {
  cl.setTempPerm('rooms_talk', false, duration, "You're muted!");

  cl._notifyIconChange("sound_mute");

  setTimeout(function() {
    cl._notifyIconChange();
  }, duration*1000);

  room.sendObject({
    type: 'roomText',
    id: room.id,
    text: "<color:9b59b6> * GlassBot has muted " + cl.username + " (" + cl.blid + ") for " + duration + " seconds"
  })
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
      text: '<color:e74c3c> * You now have ' + warnings + ' ' + (warnings == 1 ? 'warning' : 'warnings')
    });
  }

  _warningPunishment(client, warnings, room);
}

var _warningPunishment = function(client, amt, room) {
  if(amt == 1) {
    doMute(client, 5, room);
  }

  if(amt == 2) {
    doMute(client, 30, room);
  }

  if(amt == 3) {
    doMute(client, 60, room);
  }

  if(amt == 4) {
    client.kick("You've reached 4 warnings");
  }

  if(amt >= 5) {
    doRoomsBan(client, 60*Math.pow(5, amt-4), "Greater than 5 warnings");
  }
}

module.exports = {onRoomMessage, sendRoomMessage};
