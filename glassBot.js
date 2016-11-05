const moment = require('moment');

module.greetings = [
  "That's me!",
  "How's it going?",
  "Hello!",
  "Yes?"
];

module._racialSlurs = [
  "nigger",
  "nig",
  "nigg",
  "beaner",
  "faggot",
  "fag",
  "sand-nigger",
  "sandnigger",
  "spic"
]

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

  if(message == message.toUpperCase() && message.length > 5) {
    sendRoomMessage(room, "No yelling, please!");
    issueWarning(sender, 1, room);
  }

  var words = message.toLowerCase().split(/ /g);
  for(i in words) {
    var word = words[i];
    if(word == "@glassbot") {
      if(module._lastHello == null || moment().diff(moment.unix(module._lastHello), 'seconds') > 45) {
        sendRoomMessage(room, module.greetings[Math.floor(Math.random() * module.greetings)]);
        module._lastHello = moment().unix();
      }
    }

    if(word == "nigger" || word == "nig" || word == "nigg") {
      sendRoomMessage(room, "Discimination is not welcome here.");

      setTimeout(()=>{
        room.sendObject({
          type: 'roomText',
          id: room.id,
          text: '<color:9b59b6> * GlassBot banned ' + sender.username + ' for ' +  60*5 + ' seconds'
        });
        doRoomsBan(sender, 60*5, "Discimination is not welcome")
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
      sendRoomMessage(room, "Slow down there, sparky!");
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
      sendRoomMessage(room, "Don't repeat yourself so often");
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

  if(room != null) {
    room.sendObject({
      type: 'roomText',
      id: room.id,
      text: '<color:9b59b6> * ' + client.username + ' now has ' + warnings + ' ' + (warnings == 1 ? 'warning' : 'warnings') + '!'
    });
  }

  _warningPunishment(client, warnings, room);
}

var _warningPunishment = function(client, amt, room) {
  if(amt == 1) {
    client.setTempPerm('rooms_talk', false, 5, "You're muted!");
  }

  if(amt == 2) {
    doMute(client, 30, room);
  }
}

module.exports = {onRoomMessage, sendRoomMessage};
