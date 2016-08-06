const net = require('net');
const config = require('./config');

const Clients = require('./client');
const Chatrooms = require('./chatroom');

const clientServer = net.createServer((c) => { //'connection' listener
  c.on('data', (raw) => {
    raw = raw.toString().trim();
    var lines = raw.split('\n');

    for(var i = 0; i < lines.length; i++) {
      line = lines[i].trim();
      try {
        var data = JSON.parse(line);
      } catch (e) {
        console.log("Invalid JSON received: (" + i + ") " + line);
        return;
      }

      if(data.type == "auth") {
        console.log("Authing");
        Clients.create(data.ident, (data.override == 1 ? true : false), function(err, client) {
          console.log("created");
          if(err == null) {
            client.connection = c;
            c.client = client;

            var obj = {
              "type": "auth",
              "status": "success",
              "primary": client.isPrimary
            };

            client.sendObject(obj);

            var gd = Chatrooms.getFromTitle('General Discussion');
            gd.addClient(client);

          } else {
            console.log("error");
            if(err == "auth") {
              obj = {
                "type": "auth",
                "status": "failed"
              };
              c.write(JSON.stringify(obj) + '\r\n');
              c.destroy();
            }
          }
        }.bind({c: c}));
      } else {
        if(c.client != null) {
          handleData(c.client, c, data);
        }
      }
    }

  });

  c.on('end', () => {
    if(c.client != null && c.blid != null)
      c.client.cleanUp(3);

    console.log('Client disconnected');
  });

  c.on('close', () => {
    if(c.client != null && c.blid != null)
      c.client.cleanUp(1);

    console.log('Client closed');
  });

  c.on('error', (err) => {
    if(err == 'EPIPE' || err == 'ECONNRESET') {
      c.client.cleanUp(1);
      //not really an error, just a disconnect we didnt catch
    } else {
      c.client.cleanUp(3);
      //console.error('Caught error', err);
    }
    console.log('Client error');
  });
});

const noteServer = net.createServer((c) => { //'connection' listener
  console.log('note connected');
  c.on('end', () => {
    console.log('note disconnected');
  });

  c.on('data', (data) => {
    obj = JSON.parse(data);

    if(obj.type == 'notification') {
      Users.get(obj.target, function(user) {
        dat = {
          "type":"notification",
          "title":obj.title,
          "text":obj.text,
          "image":obj.image,
          "duration":obj.duration,
          "callback":obj.callback
        };
        user.messageClients(JSON.stringify(dat));
      }.bind({obj, obj}));
    }
  });

  c.on('error', (err) => {
    //console.error('Caught error', err);
  });
});

const infoServer = net.createServer((c) => { //'connection' listener
  console.log('server connected: ' + c.remoteAddress);
  c.on('end', () => {
    console.log('server disconnected');
  });

  c.on('data', (data) => {
    try {
      obj = JSON.parse(data);
    } catch (e) {
      return;
    }
    var ip = c.remoteAddress;
    var idx = ip.lastIndexOf(':');
    ip = ip.substring(idx+1);
    if(ip == "127.0.0.1")
      ip = "174.62.132.184";

    //.log(ip);

    if(obj.type == 'identify') {
      listing = serverlist.getServer(ip, obj.port);
      if(listing == false) {
        console.log("listing not found, TODO");
      } else {
        console.log("server identified");
        listing.update('hasGlass', true);
        listing.update('hostId', obj.blid);
      }

      c.listing = listing;
    } else if(obj.type == "updateValue") {
      //console.log("update: " + obj.key + " " + obj.value);
      if(c.listing)
        c.listing.update(obj.key, obj.value);
    }
  });

  c.on('error', (err) => {
    //console.error('Caught error', err);
  });
});

clientServer.listen(config.basePort, () => { //'listening' listener
  console.log('Bound ' + config.basePort);
});

noteServer.listen(config.basePort+1, () => { //'listening' listener
  console.log('Bound ' + (config.basePort+1));
});

infoServer.listen(config.basePort+2, () => { //'listening' listener
  console.log('Bound ' + (config.basePort+2) + '\r\n');
});

function handleData(client, c, data) {
  switch(data.type) {

    //================================
    // rooms
    //================================

    case "roomChat":
      var cr = Chatrooms.getFromId(data.room);
      if(cr != false) {
        cr.sendMessage(c.client, data.message);
      } else {
        console.log("failed to find room", data);
      }
      break;

    case "roomLeave":
      var cr = Chatrooms.getFromId(data.id);
      cr.removeUser(c.client, 0);
      break;

    case "roomJoin":
      var cr = Chatrooms.getFromId(data.id);
      cr.addClient(c.client);
      break;

    case "roomAwake":
      dat = {
        "type": "roomAwake",
        "id": data.id,
        "user": c.blid,
        "awake": data.bool
      };
      var cr = Chatrooms.getFromId(data.id);

      if(cr != false)
        cr.transmit(JSON.stringify(dat));

      break;

    case "roomCommand":
      var cr = Chatrooms.getFromId(data.room);
      cr.onCommand(c.client, data.message);
      break;

    case "getRoomList":
      var rooms = Chatrooms.getAllChatrooms();
      var obj = {
        "type": "roomList"
      };

      var roomArray = [];
      for(i in rooms) {
        var room = rooms[i];
        var o = {
          "id": room.id,
          "title": room.title,
          "users": room.clients.length,
          "image": room.image
        };

        if(room.userRequirement != null) {
          if(!c.client[room.userRequirement])
            continue;
          else {
            o.private = true;
          }
        }
        roomArray.push(o);
      }

      obj.rooms = roomArray;
      client.write(JSON.stringify(obj));
      break;

    //================================
    // messages
    //================================

    case "message":
      Users.get(data.target, function(target) {
        if(target.isOnline()) {
          obj = {
            "type": "message",
            "message": data.message,
            "sender": c.client.username,
            "sender_id": c.blid,
            "timestamp": moment().unix(),
            "datetime": moment().format('h:mm:ss a')
          };
          target.messagePrimary(JSON.stringify(obj));
        } else {
          obj = {
            "type": "messageNotification",
            "message": "User is offline.",
            "chat_blid": data.target,
            "timestamp": moment().unix(),
            "datetime": moment().format('h:mm:ss a')
          };
          c.write(JSON.stringify(obj) + '\r\n');
        }
      }.bind({c: c, data: data}));
      break;

      case "messageTyping":
        Users.get(data.target, function(target) {
          obj = {
            "type": "messageTyping",
            "typing": data.typing,
            "sender": c.blid,
            "timestamp": moment().unix(),
            "datetime": moment().format('h:mm:ss a')
          };
          target.messagePrimary(JSON.stringify(obj));
        }.bind({c: c, data: data}));
        break;

      case "messageClose":
        Users.get(data.target, function(target) {
          obj = {
            "type": "messageNotification",
            "message": "User closed chat window.",
            "chat_blid": data.target,
            "timestamp": moment().unix(),
            "datetime": moment().format('h:mm:ss a')
          };
          target.messagePrimary(JSON.stringify(obj));
        }.bind({c: c, data: data}));
        break;

    //================================
    // friends
    //================================

    case "locationUpdate":
      if(data.action == "playing") {
        c.client.setLocation(data.action, data.location);
      } else {
        c.client.setLocation(data.action);
      }
      break;

    case "locationGet":
      // TODO privacy settings
      Users.get(data.target, function(target) {
        obj = {
          "type": "location",
          "blid": c.client.blid,
          "activity": c.client.activity,
          "location": c.client.location
        };
        target.messagePrimary(JSON.stringify(obj));
      }.bind({c: c, data: data}));
      break;

    case "friendRequest":
      if(data.target < 0 || data.target == c.blid) {
        console.log("friend request failed, invalid id");
        return;
      }

      Users.get(data.target, function(target) {
        target.newFriendRequest(c.user);
      }.bind({c: c, data: data}));
      break;

    case "friendAccept":
      c.user.acceptFriend(data.blid);
      break;

    case "friendDecline":
      c.user.declineFriend(data.blid);
      break;

    case "queryServerList":
      var servers = serverlist.getAll();
      for(addr in servers) {
        server = servers[addr];
        if(server.hasGlass) {
          var obj = {
            "type": "serverListing",
            "addr": addr,
            "hasGlass": server.hasGlass,
            "blid": server.blid
          };
          c.write(JSON.stringify(obj) + '\r\n');
        }
      }
      break;

    case "linkForum":
      var url = data.url;
      id = url.replace("http://", "").replace("https://", "").replace("forum.blockland.us/", "").replace("index.php?", "").replace("action=profile", "").replace("u=", "").replace(";", "");
      if(!isNaN(id)) {
        Users.get(c.blid, function(user) {
          user.addForumId(id, function(success) {
            if(success) {

            }
          }.bind({user: user}));
        })
      } else {
        console.log("NaN: " + id);
      }
      break;

    case "disconnect":
      c.client.cleanUp(data.reason);
      c.end();
      break;

    case "groupCreate":
      clients = data.invite;
      Groupchat.createGroup(c.client, clients, function(success, group) {
        console.log("group create success: " + success);
      });

    default:
      console.log("unhandled: " + data.type);
  }
}
