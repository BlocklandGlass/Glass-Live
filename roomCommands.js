const EventEmitter = require('events');
const moment = require('moment');

const Database = require('./database');

const clientConnection = require('./clientConnection');

const logging = require('./dataLogging');

class RoomCommands extends EventEmitter {}

global.startTime = moment();

var newCommandSet = function(room) {
  var commandSet = new RoomCommands();
  commandSet.room = room;

  commandSet.on('help', (client, args) => {
    var command = {};
    command['help'] = "Shows available commands";
    command['warnings'] = "Shows how many temporary warnings you have";
    command['rules'] = "Shows the rules";
    command['motd'] = "Prints current room's message of the day for yourself";
    command['uptime'] = "How long the Glass Live server has been online";
    command['time'] = "The server's local time";
    command['seticon'] = "<icon>\tSets your icon";
    command['getid'] = "<username...>\tReturns blid of user";
    var pubCmdCt = Object.keys(command).length;

    if(client.isMod) {
      command['mute'] = "<seconds> <username...>\tMutes user for the duration";
      command['muteid'] = "<seconds> <blid>\tMutes user for the duration";

      command['kick'] = "<username...>\tKicks user from room";
      command['kickid'] = "<blid>\tKicks user from room";

      command['banid'] = "<minutes> <blid> <reason...>\tBans user from all rooms";
      command['unbanid'] = "<blid>\tUnbans user from all rooms";

      command['barid'] = "<minutes> <blid> <reason...>\tBars user from all Glass Live services";
      command['unbarid'] = "<blid>\tUnbars user from all Glass Live services";

      command['resetwarnings'] = "<username...>\tResets user's warnings";
      command['resetwarningsid'] = "<blid>\tResets user's warnings";

      command['getperm'] = "<blid>\tGet user's permissions";
      command['getpermid'] = "<blid>\tGet online/offline user's permissions";
    }

    var modCmdCt = Object.keys(command).length;

    if(client.isAdmin) {
      command['announce'] = "<message...>\tBroadcasts a message in all rooms";

      command['setmotd'] = "<motd...>\tSets the room's MOTD";

      command['ping'] = "<args...>\tPong";

      command['glassupdate'] = "<version>\tNotifies clients an update is available";

      command['forceicon'] = "<icon> <username...>\tForces an icon change for a user";
      command['forceiconid'] = "<icon> <blid>\tForces an icon change for an online/offline user";

      command['resetperm'] = "<username...>\tResets user's permissions";
      command['resetpermid'] = "<blid>\tResets online/offline user's permissions";
    }

    var msg = "<color:444444><br>Public Commands:";
    var i = 0;
    for(var cmd in command) {
      if(msg != "")
        msg = msg + '<br>';

      if(i == pubCmdCt) {
        msg = msg + '<br>Mod Commands:<br>';
      } else if(i == modCmdCt) {
        msg = msg + '<br>Admin Commands:<br>';
      }
      i++;

      msg = msg + "<color:e74c3c>/" + cmd;
      if(command[cmd].indexOf('\t') > -1) {
        var field = command[cmd].split('\t');
        msg = msg + " " + field[0] + " <color:555555>" + field[1];
      } else {
        msg = msg + " <color:555555>" + command[cmd];
      }
    }

    client.sendObject({
      type: 'roomText',
      id: room.id,
      text: msg
    });
  });

  commandSet.on('rules', (client, args) => {
    // var rules = [
      // "1. Be respectful.",
      // "2. Do not spam.",
      // "3. Do not type in all caps.",
      // "4. Do not use derogatory/discriminatory words or statements."
    // ]
    var rules = [
      "1. Be respectful.",
      "2. Do not spam.",
      "3. Do not post or link to NSFW content."
    ]

    var str = "<br>Rules:";
    for(var i in rules) {
      str = str + "<br>" + rules[i];
    }

    client.sendObject({
      type: 'roomText',
      id: room.id,
      text: str
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


  commandSet.on('getid', (client, args) => {

    var cl = room.findClientByName(args.join(' '));
    if(cl != false) {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: ' * ' + cl.username + '\'s blid is ' + cl.blid
      });
    } else {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: ' * Unable to find user "' + args.join(' ') + '"'
      });
    }
  })


  commandSet.on('ping', (client, args) => {
    if(!client.isAdmin) return;

    client.sendObject({
      type: 'error',
      message: "pong! " + args.join(' '),
      showDialog: true
    });
  });

  commandSet.on('mute', (client, args) => {
    if(!client.isMod) return;

    if(args[0] == -1) {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: ' * Permanent duration is not supported yet.'
      });
      return;
    }

    var duration = parseInt(args[0]);
    args.splice(0, 1);

    if(duration <= 0 || duration == NaN)
      return; //inavlid

    var cl = room.findClientByName(args.join(' '));
    if(cl != false) {
      cl.setTempPerm('rooms_talk', false, duration, "You're muted!");

      room.sendObject({
        type: 'roomText',
        id: room.id,
        text: "<color:e74c3c> * " + client.username + " has muted " + cl.username + " (" + cl.blid + ") for " + duration + " seconds"
      })

      logging.logRoomEvent(room.id, 'mod', client.username + " has muted " + cl.username + " (" + cl.blid + ") for " + duration + " seconds");

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
    if(!client.isMod) return;

    if(args[0] == -1) {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: ' * Permanent duration is not supported yet.'
      });
      return;
    }

    var duration = parseInt(args[0]);

    if(duration <= 0 || duration == NaN)
      return; //inavlid

    if(args.length < 2) {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: ' * Format: /muteid <seconds> <blid>'
      });
      return;
    }

    var cl = clientConnection.getFromBlid(args[1])
    if(cl != false) {
      cl.setTempPerm('rooms_talk', false, duration, "You're muted!");

      room.sendObject({
        type: 'roomText',
        id: room.id,
        text: " * " + client.username + " has muted " + cl.username + " (" + cl.blid + ") for " + duration + " seconds"
      })

      logging.logRoomEvent(room.id, 'mod', client.username + " has muted " + cl.username + " (" + cl.blid + ") for " + duration + " seconds");

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
    if(!client.isMod) return;

    var cl = room.findClientByName(args.join(' '));
    if(cl != false) {

      cl.setTempPerm('rooms_join', false, 1000, "You've been kicked!");

      room.sendObject({
        type: 'roomText',
        id: room.id,
        text: "<color:e74c3c> * " + client.username + " has kicked " + cl.username + " (" + cl.blid + ")"
      })

      logging.logRoomEvent(room.id, 'mod', client.username + " has kicked " + cl.username + " (" + cl.blid + ")");

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
    if(!client.isMod) return;

    var cl = clientConnection.getFromBlid(args[0])
    if(cl != false) {

      cl.setTempPerm('rooms_join', false, 1000, "You've been kicked!");

      room.sendObject({
        type: 'roomText',
        id: room.id,
        text: "<color:e74c3c> * " + client.username + " has kicked " + cl.username + " (" + cl.blid + ")"
      })

      logging.logRoomEvent(room.id, 'mod', client.username + " has kicked " + cl.username + " (" + cl.blid + ")");

      cl.kick();
    } else {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: ' * Unable to find blid "' + args[0] + '"'
      });
    }
  })

  commandSet.on('banid', (client, args) => {
    if(!client.isMod) return;

    if(args[0] == -1) {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: ' * Permanent duration is not supported yet.'
      });
      return;
    }

    var duration = parseInt(args[0])*60;

    if(duration <= 0 || duration == NaN)
      return; //inavlid

    if(args.length < 2) {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: ' * Format: /banid <minutes> <blid> <reason...>'
      });
      return;
    }

    var reason = args.slice(2).join(' ');
    reason.trim();

    if(reason == "") {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: ' * You must specify a reason'
      });
      return;
    }

    var cl = clientConnection.getFromBlid(args[1])
    if(cl != false) {

      cl.setTempPerm('rooms_join', false, duration, reason);

      room.sendObject({
        type: 'roomText',
        id: room.id,
        text: "<color:e74c3c> * " + client.username + " has banned " + cl.username + " (" + cl.blid + ") from public rooms for " + duration/60 + " minutes: " + reason
      })

      logging.logRoomEvent(room.id, 'mod', client.username + " has banned " + cl.username + " (" + cl.blid + ") from public rooms for " + duration/60 + " minutes: " + reason);

      cl.roomBan(duration, reason);
    } else {
      Database.getUserData(args[1], function(data, err) {
        if(err != null) {
          client.sendObject({
            type: 'roomText',
            id: room.id,
            text: ' * Unable to find blid "' + args[1] + '"'
          });
          return;
        }

        var permSet = require('./permissions').createSet(data);
        /* copied from clientConnection.js ClientConnection.prototype.roomBan */
        permSet.newTempPermission('rooms_join', false, duration, reason);
        permSet.newTempPermission('rooms_talk', false, duration, reason);

        /* copied from ClientConnection.prototype.savePersist */
        data.permissions = permSet.perms;
        data.tempPermissions = permSet.temp;

        Database.saveUserData(args[1], data);

        room.sendObject({
          type: 'roomText',
          id: room.id,
          text: '<color:e74c3c> * ' + client.username + ' has banned offline user ' + data.username + ' (' + args[1] + ') from public rooms for ' + duration/60 + ': ' + reason
        });

        logging.logRoomEvent(room.id, 'mod', client.username + ' has banned offline user ' + data.username + ' (' + args[1] + ') from public rooms for ' + duration/60 + ': ' + reason);
      })
    }
  })

  commandSet.on('unbanid', (client, args) => {
    if(!client.isMod) return;

    if(args.length < 1) {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: ' * Format: /unbanid <blid>'
      });
      return;
    }

    var cl = clientConnection.getFromBlid(args[1])
    if(cl != false) {

      cl.setTempPerm('rooms_join', true, 1, "");

      room.sendObject({
        type: 'roomText',
        id: room.id,
        text: "<color:e74c3c> * " + client.username + " has unbanned " + cl.username + " (" + cl.blid + ")"
      })

      logging.logRoomEvent(room.id, 'mod', client.username + " has unbanned " + cl.username + " (" + cl.blid + ")");
    } else {
      Database.getUserData(args[0], function(data, err) {
        if(err != null) {
          client.sendObject({
            type: 'roomText',
            id: room.id,
            text: ' * Unable to find blid "' + args[1] + '"'
          });
          return;
        }

        var permSet = require('./permissions').createSet(data);

        permSet.newTempPermission('rooms_join', true, 1, "");

        /* copied from ClientConnection.prototype.savePersist */
        data.permissions = permSet.perms;
        data.tempPermissions = permSet.temp;

        Database.saveUserData(args[0], data);

        room.sendObject({
          type: 'roomText',
          id: room.id,
          text: "<color:e74c3c> * " + client.username + " has unbanned " + data.username + " (" + args[0] + ")"
        })

        logging.logRoomEvent(room.id, 'mod', client.username + " has unbanned " + data.username + " (" + args[0] + ")");
      })
    }
  })

  commandSet.on('barid', (client, args) => {
    if(!client.isMod) return;

    if(args.length < 2) {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: ' * Too few arguments!'
      });
      return;
    }

    if(args[0] == -1) {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: ' * Permanent duration is not supported yet.'
      });
      return;
    }

    var duration = parseInt(args[0])*60;

    if(duration <= 0 || duration == NaN)
      return; //inavlid

    if(args.length < 2) {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: ' * Format: /barid <minutes> <blid> <reason...>'
      });
      return;
    }

    var reason = args.slice(2).join(' ');
    reason.trim();

    if(reason == "") {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: ' * You must specify a reason'
      });
      return;
    }

    var cl = clientConnection.getFromBlid(args[1])
    if(cl != false) {

      cl.setTempPerm('service_use', false, duration, reason);

      room.sendObject({
        type: 'roomText',
        id: room.id,
        text: "<color:e74c3c> * " + client.username + " has barred " + cl.username + " (" + cl.blid + ") from Glass Live for " + duration/60 + " minutes: " + reason
      })

      logging.logRoomEvent(room.id, 'mod', client.username + " has barred " + cl.username + " (" + cl.blid + ") from Glass Live for " + duration/60 + " minutes: " + reason);

      cl.bar(duration, reason);
    } else {
      Database.getUserData(args[1], function(data, err) {
        if(err != null) {
          client.sendObject({
            type: 'roomText',
            id: room.id,
            text: ' * Unable to find blid "' + args[1] + '"'
          });
          return;
        }

        var permSet = require('./permissions').createSet(data);

        permSet.newTempPermission('service_use', false, duration, reason);

        /* copied from ClientConnection.prototype.savePersist */
        data.permissions = permSet.perms;
        data.tempPermissions = permSet.temp;

        Database.saveUserData(args[1], data);

        room.sendObject({
          type: 'roomText',
          id: room.id,
          text: '<color:e74c3c> * ' + client.username + ' has barred offline user ' + data.username + ' (' + args[1] + ') from Glass Live for ' + duration/60 + ' minutes: ' + reason
        });

        logging.logRoomEvent(room.id, 'mod', client.username + ' has barred offline user ' + data.username + ' (' + args[1] + ') from Glass Live for ' + duration/60 + ' minutes: ' + reason);
      })
    }
  })

  commandSet.on('unbarid', (client, args) => {
    if(!client.isMod) return;

    if(args.length < 1) {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: ' * Format: /unbarid <blid>'
      });
      return;
    }

    var cl = clientConnection.getFromBlid(args[1])
    if(cl != false) {

      cl.setTempPerm('service_use', true, 1, "");

      room.sendObject({
        type: 'roomText',
        id: room.id,
        text: "<color:e74c3c> * " + client.username + " has unbarred " + cl.username + " (" + cl.blid + ")"
      })

      logging.logRoomEvent(room.id, 'mod', client.username + " has unbarred " + cl.username + " (" + cl.blid + ")");
    } else {
      Database.getUserData(args[0], function(data, err) {
        if(err != null) {
          client.sendObject({
            type: 'roomText',
            id: room.id,
            text: ' * Unable to find blid "' + args[1] + '"'
          });
          return;
        }

        var permSet = require('./permissions').createSet(data);

        permSet.newTempPermission('service_use', true, 1, "");

        /* copied from ClientConnection.prototype.savePersist */
        data.permissions = permSet.perms;
        data.tempPermissions = permSet.temp;

        Database.saveUserData(args[0], data);

        room.sendObject({
          type: 'roomText',
          id: room.id,
          text: "<color:e74c3c> * " + client.username + " has unbarred " + data.username + " (" + args[0] + ")"
        })

        logging.logRoomEvent(room.id, 'mod', client.username + " has unbarred " + data.username + " (" + args[0] + ")");
      })
    }
  })

  commandSet.on('setmotd', (client, args) => {
    if(!client.isAdmin) return;

    var motd = args.join(' ');

    logging.logRoomEvent(room.id, 'sys', client.username + " has set the MOTD to " + motd);

    room.setMOTD(client, motd);
    room.sendObject({
      type: 'roomText',
      id: room.id,
      text: "* " + client.username + " has set the MOTD to: " + motd
    })
  });

  commandSet.on('announce', (client, args) => {
    if(!client.isAdmin) return;

    if(args.length == 0)
      return;

    var announcement = args.join(' ');
    var msg = '<color:54d98c> * ' + announcement;

    var rooms = require('./chatRoom').getAll();
    for(var i in rooms) {
      var room = rooms[i];
      room.sendObject({
        type: 'roomText',
        id: room.id,
        text: msg
      })
    }

    logging.logGlobalRoomEvent('sys', client.username + " announced: " + announcement);
  });

  commandSet.on('resetperm', (client, args) => {
    if(!client.isAdmin) return;

    if(args.length < 1) {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: ' * Too few arguments!'
      });
      return;
    }

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

  commandSet.on('resetpermid', (client, args) => {
    if(!client.isAdmin) return;

    if(args.length < 1) {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: ' * Too few arguments!'
      });
      return;
    }

    var blid = args[0];
    var cl = clientConnection.getFromBlid(args[0]);
    if(cl == false) {
      Database.getUserData(blid, function(data, err) {
        if(err != null) {
          client.sendObject({
            type: 'roomText',
            id: room.id,
            text: '* Error updating user data for blid "' + blid + '"'
          });
          return;
        }

        data.permissions = {};
        data.tempPermissions = {};
        Database.saveUserData(blid, data);
        client.sendObject({
          type: 'roomText',
          id: room.id,
          text: ' * Reset permissions for offline user ' + data.username
        });
      });
    } else {
      cl.resetPermissions();
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: ' * Reset permissions for ' + cl.username
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
      text: ' * You have ' + warnings + ' temporary ' + (warnings == 1 ? 'warning' : 'warnings')
    });
  });

  commandSet.on('resetwarnings', (client, args) => {
    if(!client.isMod) return;

    var cl = room.findClientByName(args.join(' '));
    if(cl != false) {
      cl.persist.warnings = 0;
      cl.savePersist();

      room.sendObject({
        type: 'roomText',
        id: room.id,
        text: " * " + client.username + " reset " + cl.username + "'s warnings"
      });
    } else {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: '* Unable to find user "' + args.join(' ') + '"'
      });
    }
  });

  commandSet.on('resetwarningsid', (client, args) => {
    if(!client.isMod) return;

    var blid = args[0];
    var cl = clientConnection.getFromBlid(args[0]);
    if(cl != false) {
      cl.persist.warnings = 0;
      cl.savePersist();

      room.sendObject({
        type: 'roomText',
        id: room.id,
        text: " * " + client.username + " reset " + cl.username + "'s warnings"
      });
    } else {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: ' * Unable to find blid "' + blid + '"'
      });
    }
  });

  commandSet.on('glassupdate', (client, args) => {
    if(!client.isAdmin) return;

    if(args.length != 1) {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: ' * Format: /glassupdate <version>'
      });
      return;
    }

    clientConnection.sendObjectAll({
      type: 'glassUpdate',
      version: args[0]
    });
  });

  commandSet.on('getperm', (client, args) => {
    if(!client.isMod) return;

    if(args.length < 1) {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: ' * Too few arguments!'
      });
      return;
    }

    var cl = room.findClientByName(args.join(' '));

    if(cl == false) {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: '* Unable to find user "' + args.join(' ') + '"'
      });
      return;
    }

    var blid = cl.blid;

    Database.getUserData(blid, function(data, err) {
      if(err != null) {
        client.sendObject({
          type: 'roomText',
          id: room.id,
          text: '* Error getting user data for blid "' + blid + '"'
        });
        return;
      }

      var permSet = require('./permissions').createSet(data);

      var msg = "<br>User permissions for blid: " + blid + "<br>";

      msg = msg + "   Barred";

      if(permSet.hasPermission('service_use')) {
        msg = msg + ": NO<br>";
      } else {
        msg = msg + ": YES<br>";

        if(permSet.isTempPermission('service_use')) {
          var tempData = permSet.getTempData('service_use');
          var issued = moment.unix(tempData.startTime).format('HH:mm:ss MM/DD/YYYY');
          var remaining = moment.unix(tempData.startTime + tempData.duration).format('HH:mm:ss MM/DD/YYYY');
          var remainingHuman = moment.unix(tempData.startTime + tempData.duration).fromNow();

          msg = msg + "    Issued: " + issued + "<br>";
          msg = msg + "    Duration: " + tempData.duration/60 + "m<br>";
          msg = msg + "    Reason: " + tempData.reason + "<br>";
          msg = msg + "    Expires: " + remaining + " (" + remainingHuman + ")<br>";
        } else {
          msg = msg + "    Duration: Permanent<br>";
          msg = msg + "    Expires: Never<br>";
        }
      }

      msg = msg + "   Banned";

      if(permSet.hasPermission('rooms_join')) {
        msg = msg + ": NO<br>";
      } else {
        msg = msg + ": YES<br>";

        if(permSet.isTempPermission('rooms_join')) {
          var tempData = permSet.getTempData('rooms_join');
          var issued = moment.unix(tempData.startTime).format('HH:mm:ss MM/DD/YYYY');
          var remaining = moment.unix(tempData.startTime + tempData.duration).format('HH:mm:ss MM/DD/YYYY');
          var remainingHuman = moment.unix(tempData.startTime + tempData.duration).fromNow();

          msg = msg + "    Issued: " + issued + "<br>";
          msg = msg + "    Duration: " + tempData.duration/60 + "m<br>";
          msg = msg + "    Reason: " + tempData.reason + "<br>";
          msg = msg + "    Expires: " + remaining + " (" + remainingHuman + ")<br>";
        } else {
          msg = msg + "    Duration: Permanent<br>";
          msg = msg + "    Expires: Never<br>";
        }
      }

      msg = msg + "   Muted";

      if(permSet.hasPermission('rooms_talk')) {
        msg = msg + ": NO<br>";
      } else {
        msg = msg + ": YES<br>";

        if(permSet.isTempPermission('rooms_talk')) {
          var tempData = permSet.getTempData('rooms_talk');
          var issued = moment.unix(tempData.startTime).format('HH:mm:ss MM/DD/YYYY');
          var remaining = moment.unix(tempData.startTime + tempData.duration).format('HH:mm:ss MM/DD/YYYY');
          var remainingHuman = moment.unix(tempData.startTime + tempData.duration).fromNow();

          msg = msg + "    Issued: " + issued + "<br>";
          msg = msg + "    Duration: " + tempData.duration/60 + "m<br>";
          msg = msg + "    Expires: " + remaining + " (" + remainingHuman + ")<br>";
        } else {
          msg = msg + "    Duration: Permanent<br>";
          msg = msg + "    Expires: Never<br>";
        }
      }

      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: msg
      });
    });
  });

  commandSet.on('getpermid', (client, args) => {
    if(!client.isMod) return;

    if(args.length < 1) {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: ' * Too few arguments!'
      });
      return;
    }

    var blid = args[0];

    Database.getUserData(blid, function(data, err) {
      if(err != null) {
        client.sendObject({
          type: 'roomText',
          id: room.id,
          text: '* Error getting user data for blid "' + blid + '"'
        });
        return;
      }

      var permSet = require('./permissions').createSet(data);

      var msg = "<br>User permissions for blid: " + blid + "<br>";

      msg = msg + "   Barred";

      if(permSet.hasPermission('service_use')) {
        msg = msg + ": NO<br>";
      } else {
        msg = msg + ": YES<br>";

        if(permSet.isTempPermission('service_use')) {
          var tempData = permSet.getTempData('service_use');
          var issued = moment.unix(tempData.startTime).format('HH:mm:ss MM/DD/YYYY');
          var remaining = moment.unix(tempData.startTime + tempData.duration).format('HH:mm:ss MM/DD/YYYY');
          var remainingHuman = moment.unix(tempData.startTime + tempData.duration).fromNow();

          msg = msg + "    Issued: " + issued + "<br>";
          msg = msg + "    Duration: " + tempData.duration/60 + "m<br>";
          msg = msg + "    Reason: " + tempData.reason + "<br>";
          msg = msg + "    Expires: " + remaining + " (" + remainingHuman + ")<br>";
        } else {
          msg = msg + "    Duration: Permanent<br>";
          msg = msg + "    Expires: Never<br>";
        }
      }

      msg = msg + "   Banned";

      if(permSet.hasPermission('rooms_join')) {
        msg = msg + ": NO<br>";
      } else {
        msg = msg + ": YES<br>";

        if(permSet.isTempPermission('rooms_join')) {
          var tempData = permSet.getTempData('rooms_join');
          var issued = moment.unix(tempData.startTime).format('HH:mm:ss MM/DD/YYYY');
          var remaining = moment.unix(tempData.startTime + tempData.duration).format('HH:mm:ss MM/DD/YYYY');
          var remainingHuman = moment.unix(tempData.startTime + tempData.duration).fromNow();

          msg = msg + "    Issued: " + issued + "<br>";
          msg = msg + "    Duration: " + tempData.duration/60 + "m<br>";
          msg = msg + "    Reason: " + tempData.reason + "<br>";
          msg = msg + "    Expires: " + remaining + " (" + remainingHuman + ")<br>";
        } else {
          msg = msg + "    Duration: Permanent<br>";
          msg = msg + "    Expires: Never<br>";
        }
      }

      msg = msg + "   Muted";

      if(permSet.hasPermission('rooms_talk')) {
        msg = msg + ": NO<br>";
      } else {
        msg = msg + ": YES<br>";

        if(permSet.isTempPermission('rooms_talk')) {
          var tempData = permSet.getTempData('rooms_talk');
          var issued = moment.unix(tempData.startTime).format('HH:mm:ss MM/DD/YYYY');
          var remaining = moment.unix(tempData.startTime + tempData.duration).format('HH:mm:ss MM/DD/YYYY');
          var remainingHuman = moment.unix(tempData.startTime + tempData.duration).fromNow();

          msg = msg + "    Issued: " + issued + "<br>";
          msg = msg + "    Duration: " + tempData.duration/60 + "m<br>";
          msg = msg + "    Expires: " + remaining + " (" + remainingHuman + ")<br>";
        } else {
          msg = msg + "    Duration: Permanent<br>";
          msg = msg + "    Expires: Never<br>";
        }
      }

      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: msg
      });
    });
  });

  commandSet.on('forceicon', (client, args) => {
    if(!client.isAdmin) return;

    const Icons = require('./icons.json');

    if(args.length < 2) {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: ' * Too few arguments!'
      });
      return;
    }

    var icon = args[0];
    icon.trim();

    if(Icons.allowed.indexOf(icon) == -1 && Icons.restricted.indexOf(icon) == -1) {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: "* Icon doesn't exist!"
      });
      return;
    }

    var username = args.slice(1).join(' ');
    username.trim();
    var cl = room.findClientByName(username);

    if(cl == false) {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: '* Unable to find user "' + username + '"'
      });
      return;
    }

    var blid = cl.blid;

    cl.setIcon(icon, true);

    client.sendObject({
      type: 'roomText',
      id: room.id,
      text: '* Forced icon change for user "' + username + '"'
    });
  });

  commandSet.on('forceiconid', (client, args) => {
    if(!client.isAdmin) return;

    if(args.length < 2) {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: ' * Too few arguments!'
      });
      return;
    }

    const Icons = require('./icons.json');

    var icon = args[0];
    icon.trim();

    if(Icons.allowed.indexOf(icon) == -1 && Icons.restricted.indexOf(icon) == -1) {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: "* Icon doesn't exist!"
      });
      return;
    }

    var blid = args[1];

    var cl = clientConnection.getFromBlid(blid);

    var success = false;

    if(cl != false) {
      cl.setIcon(icon, true);

      success = true;
    } else {
      Database.getUserData(blid, function(data, err) {
        if(err != null) {
          client.sendObject({
            type: 'roomText',
            id: room.id,
            text: '* Unable to find blid "' + blid + '"'
          });
          return;
        }

        data.icon = icon;
        Database.saveUserData(blid, data);

        success = true;
      });
    }

    if(success) {
      client.sendObject({
        type: 'roomText',
        id: room.id,
        text: '* Forced icon change for blid ' + blid
      });
    }
  });

  return commandSet;
}

module.exports = {newCommandSet};
