const EventEmitter = require('events');
const moment = require('moment');

const clientConnection = require('./clientConnection');

class RoomCommands extends EventEmitter {}

global.startTime = moment();

var newCommandSet = function(room) {
  var commandSet = new RoomCommands();
  commandSet.room = room;

  commandSet.on('help', (client, args) => {
    var command = {};
    command['help'] = "Shows available commands";
    command['motd'] = "Prints room's message of the day";
    command['uptime'] = "How long the Live server has been online";
    command['time'] = "Server's local time";
    command['seticon'] = "<icon>\tSets your icon";
    var pubCmdCt = Object.keys(command).length;

    if(client.isMod) {
      command['setmotd'] = "<motd...>\tSets the room's MOTD";

      command['mute'] = "<duration> <username...>\tMutes user for the duration";
      command['muteid'] = "<duration> <blid>\tMutes user for the duration";

      command['kick'] = "<username...>\tKicks user from room";
      command['kickid'] = "<blid>\tKicks user from room";

      command['ban'] = "<duration> <username...>\tBans user from all rooms";
      command['banid'] = "<duration <blid>\tBans user from room";
    }

    var msg = "Public Commands:";
    var i = 0;
    for(cmd in command) {
      if(msg != "")
        msg = msg + '<br>';

      if(i == pubCmdCt) {
        msg = msg + '<br>Mod Commands:<br>';
      }
      i++;

      msg = msg + "<color:ff0000>/" + cmd;
      if(command[cmd].indexOf('\t') > -1) {
        var field = command[cmd].split('\t');
        msg = msg + " " + field[0] + " <color:666666>" + field[1];
      } else {
        msg = msg + " <color:666666>" + command[cmd];
      }
    }

    client.sendObject({
      type: 'roomText',
      id: room.id,
      text: msg
    });
  });

  commandSet.on('motd', (client, args) => {
    client.sendObject({
      type: 'roomText',
      id: room.id,
      text: " * MOTD: " + room.persist.motd
    });
  });

  commandSet.on('uptime', (client, args) => {
    var seconds = moment().diff(global.startTime, 'seconds');
    var minutes = Math.floor(seconds/60);
    var hours = Math.floor(minutes/60);
    var days = Math.floor(hours/24);

    seconds = seconds % 60;
    minutes = minutes % 60;
    hours = hours % 24;

    str = "";
    if(days > 0) {
      str += " " + days + "d";
    }

    if(hours > 0) {
      str += " " + hours + "h";
    }

    if(minutes > 0) {
      str += " " + minutes + "m";
    }

    if(seconds > 0) {
      str += " " + seconds + "s";
    }

    str = str.trim();
    client.sendObject({
      type: 'roomText',
      id: room.id,
      text: " * Uptime: " + str
    });
  });

  commandSet.on('time', (client, args) => {
    client.sendObject({
      type: 'roomText',
      id: room.id,
      text: " * Local Time: " + moment().format('h:mm:ss a')
    });
  });

  commandSet.on('seticon', (client, args) => {
    var str = args.join(' ');
    str.trim();
    client.setIcon(str);
  });

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

  commandSet.on('muteid', (client, args) => {
    var duration = parseInt(args[0]);

    if(duration <= 0 || duration == NaN)
      return; //inavlid

    if(args.length != 2) {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: ' * Format: /muteid <duration> <blid>'
      });
      return;
    }

    var cl = clientConnection.getFromBlid(args[1])
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
        text: ' * Unable to find blid "' + args[1] + '"'
      });
    }
  })

  commandSet.on('kick', (client, args) => {
    var cl = room.findClientByName(args.join(' '));
    if(cl != false) {

      cl.setTempPerm('rooms_join', false, 1000, "You've been kicked!");

      room.sendObject({
        type: 'roomText',
        id: room.id,
        text: " * " + client.username + " kicked " + cl.username + " (" + cl.blid + ")"
      })

      cl.kick();
    } else {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: ' * Unable to find user "' + args.join(' ') + '"'
      });
    }
  })

  commandSet.on('kickid', (client, args) => {
    var cl = clientConnection.getFromBlid(args[0])
    if(cl != false) {

      cl.setTempPerm('rooms_join', false, 1000, "You've been kicked!");

      room.sendObject({
        type: 'roomText',
        id: room.id,
        text: " * " + client.username + " kicked " + cl.username + " (" + cl.blid + ")"
      })

      cl.kick();
    } else {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: ' * Unable to find blid "' + args[0] + '"'
      });
    }
  })

  commandSet.on('setmotd', (client, args) => {
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

    client.persist.warnings = 0;
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
