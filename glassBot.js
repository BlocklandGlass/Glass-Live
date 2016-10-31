const moment = require('moment');

var onRoomMessage = function(room, sender, message) {
  if(message == message.toUpperCase()) {
    sendRoomMessage(room, "No yelling, please!");
    issueWarning(sender, 1, room);
  }

  var words = message.toLowerCase().split(/ /g);
  for(i in words) {
    var word = words[i];
    if(word == "@glassbot") {
      if(module._lastHello == null || moment().diff(moment.unix(module._lastHello), 'seconds') > 45) {
        sendRoomMessage(room, "That's me!");
        module._lastHello = moment().unix();
      }
    }

    if(word == "nigger" || word == "nig" || word == "nigg") {
      sendRoomMessage(room, "Racial slurs are not welcome here.");

      setTimeout(()=>{
        room.sendObject({
          type: 'roomText',
          id: room.id,
          text: '<color:9b59b6> * GlassBot banned ' + sender.username + ' for ' +  60*5 + ' seconds'
        });
        doRoomsBan(sender, 60*5, "Racial slurs are not welcome")
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

var doRoomsBan = function(client, duration, reason) {
  client.roomBan(duration, reason);
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
}

module.exports = {onRoomMessage, sendRoomMessage};
