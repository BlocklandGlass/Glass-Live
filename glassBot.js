const moment = require('moment');

var onRoomMessage = function(room, sender, message) {
  var words = message.toLowerCase().split(/ /g);
  for(i in words) {
    var word = words[i];
    if(word == "@glassbot") {
      sendRoomMessage(room, "That's me!");
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

module.exports = {onRoomMessage, sendRoomMessage};
