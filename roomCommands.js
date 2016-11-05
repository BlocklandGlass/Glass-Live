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
        text: ' * Muted ' + cl.username + ' for ' + duration + ' seconds'
      });

      cl.setTempPerm('rooms_talk', false, duration, "You're muted!");

      room.sendObject({
        type: 'roomText',
        id: room.id,
        text: " * " + client.username + " has muted " + cl.username + " (" + cl.blid + ") for " + duration + " seconds"
      })

      cl._notifyIconChange("sound_mute");

      setTimeout(function() {
        cl._notifyIconChange();
        cl.sendObject({
          type: 'roomText',
          id: room.id,
          text: ' * Your mute has expired'
        })
      }, duration*1000);

    } else {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: ' * Unable to find user "' + args.join(' ') + '"'
      });
    }
  })

  commandSet.on('motd', (client, args) => {
    room.setMOTD(args.join(' '));
    room.sendObject({
      type: 'roomText',
      id: room.id,
      text: "* " + client.username + " has set the MOTD to " + args.join(' ')
    })
  });

  commandSet.on('resetPermissions', (client, args) => {
    if(!client.isMod)
      return;

    var cl = room.findClientByName(args.join(' '));
    if(cl != false) {
      cl.persist.permissions = {};
      cl.persist.tempPermissions = {};
      if(cl._permissionSet != null) {
        cl._permissionSet.perms = {};
        cl._permissionSet.temp = {};
      }
      cl.savePersist();

      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: ' * Reset permissions for ' + cl.username
      });
    } else {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: '* Unable to find user "' + args.join(' ') + '"'
      });
    }
  })

  commandSet.on('warnings', (client, args) => {
    var warnings = 0;
    if(client.persist.warnings != null)
      warnings = client.persist.warnings;

    client.sendObject({
      type: 'roomText',
      id: room.id,
      text: ' * You have ' + warnings + ' ' + (warnings == 1 ? 'warning' : 'warnings')
    });
  });

  commandSet.on('resetWarnings', (client, args) => {
    if(!client.isMod)
      return;

    client.persist.warnings += amt;
    client.savePersist();

    client.sendObject({
      type: 'roomText',
      id: room.id,
      text: ' * Your warnings have been reset'
    });
  });

  return commandSet;
}

module.exports = {newCommandSet};
