const moment = require('moment');

var onRoomMessage = function(room, sender, message) {
  var words = message.toLowerCase().split(/ /g);
  for(i in words) {
    var word = words[i];
    if(word == "@glassbot") {
      sendRoomMessage(room, "That's me!");
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
  setTimeout(function() {
      room.sendObject({
      type: "roomMessage",
      room: room.id,

      sender: "GlassBot",
      sender_id: -1,

      msg: message,

      timestamp: moment().unix(),
      datetime: moment().format('h:mm:ss a')
    });
  }, Math.floor(Math.random()*1000)+100);
}

var doRoomsBan = function(client, duration, reason) {
  client.roomBan(duration, reason);
}

module.exports = {onRoomMessage, sendRoomMessage};
