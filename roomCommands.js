const EventEmitter = require('events');

class RoomCommands extends EventEmitter {}

var newCommandSet = function(room) {
  var commandSet = new RoomCommands();
  commandSet.room = room;
  commandSet.on('ping', (client, args) => {
    client.sendObject({
      type: 'error',
      message: "pong! " + args.join(' '),
      showDialog: true
    });
  });

  commandSet.on('mute', (client, args) => {
    var duration = parseInt(args[0]);
    args.splice(0, 1);

    if(duration <= 0 || duration == NaN)
      return; //inavlid

    var cl = room.findClientByName(args.join(' '));
    if(cl != false) {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: '* Muted ' + cl.username + ' for ' + duration + ' seconds'
      });

      cl.setTempPerm('rooms_talk', false, duration, "You're muted!");

      room.sendObject({
        type: 'roomText',
        id: room.id,
        text: "* " + client.username + " has muted " + cl.username + " (" + cl.blid + ") for " + duration + " seconds"
      })
    } else {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: '* Unable to find user "' + args.join(' ') + '"'
      });
    }
  })

  return commandSet;
}

module.exports = {newCommandSet};
