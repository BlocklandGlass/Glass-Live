const net = require('net');
const database = require('./database');
const Chatroom = require('./chatroom');
const Client = require('./client');
const Users = require('./user');
const gd = new Chatroom('General Discussion');
const moment = require('moment');
const serverlist = require('./serverlist');

const config = require('./config');

global.uptime = moment().unix();

const clientServer = net.createServer((c) => { //'connection' listener
  c.on('end', () => {
    if(c.client != null)
      c.client.cleanUp();

    console.log('Client disconnected');
  });

  c.on('close', () => {
    if(c.client != null)
      c.client.cleanUp();

    console.log('Client closed');
  });

  c.on('data', (raw) => {
    try {
      var data = JSON.parse(raw);
    } catch (e) {
      console.log("Invalid JSON received: " + raw);
      return;
    }

    switch(data.type) {
      case "auth":
        var result = c.client.authCheck(data.ident);
        if(result) {
          console.log("Connected (" + c.client.blid + ", " + data.ident + ")");
          c.write('{"type":"auth", "status":"success"}\r\n');
          c.blid = c.client.blid;
          Users.get(c.client.blid, function(user) {
            c.user = user;
            if(c.user.clients.length > 0) {
              c.user.clients[0].disconnect(1);
            }

            //console.log("[debug] addClient");
            c.user.addClient(c.client);
            //console.log("[debug] setUsername");
            c.user.setUsername(c.client.username);

            c.client.sendFriendsList();
            c.client.sendFriendRequests();

          }.bind({c: c}));
          gd.addUser(c.client);
        } else {
          console.log('Auth failed for ' + c.client.blid);
          c.write('{"type":"auth", "status":"failed"}\r\n');
          c.destroy();
          return;
        }

        // TODO send friend requests
        // TODO send pub room listing

        //gd.sendMessage(c.client, "hey guys!!!");
        break;

      //================================
      // rooms
      //================================

      case "roomChat":
        gd.sendMessage(c.client, data.message);
        break;

      case "roomLeave":
        gd.removeUser(c.client, 0);
        break;

      case "roomJoin":
        gd.addUser(c.client);
        break;

      case "roomAwake":
        dat = {
          "type": "roomAwake",
          "id": gd.id,
          "user": c.blid,
          "awake": data.bool
        };
        gd.transmit(JSON.stringify(dat));
        break;

      case "roomCommand":
        gd.onCommand(c.client, data.message);
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
            target.messageClients(JSON.stringify(obj));
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
            target.messageClients(JSON.stringify(obj));
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
            target.messageClients(JSON.stringify(obj));
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
          target.messageClients(JSON.stringify(obj));
        }.bind({c: c, data: data}));
        break;

      case "friendRequest":
        if(data.target < 0 || data.target == c.blid)
          return;

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

      default:
        console.log("unhandled: " + data.type);
    }
      //pushNotification(c, "Connected", "Connected to Glass Notification server", "star", "5000", "");
      //pushNotification(c, "Blockoworld", "Blockoworld is happening RIGHT NOW! Click me for more information.", "bricks", "0", "");
  });

  c.on('error', (err) => {
    if(err == 'EPIPE' || err == 'ECONNRESET') {
      //not really an error, just a disconnect we didnt catch
    } else {
      console.error('Caught error', err);
    }
    c.client.cleanUp();
  });

  c.client = Client.create(c);
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
    obj = JSON.parse(data);
    var ip = c.remoteAddress;
    var idx = ip.lastIndexOf(':');
    ip = ip.substring(idx+1);
    if(ip == "127.0.0.1")
      ip = "174.62.132.184";

    console.log(ip);

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
      console.log("update: " + obj.key + " " + obj.value);
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

function pushNotification(con, title, text, image, duration, callback) {
  dat = {
    "type":"notification",
    "title":title,
    "text":text,
    "image":image,
    "duration":duration,
    "callback":callback
  };

  str = JSON.stringify(dat);
  //console.log(str);
  con.write(str + '\r\n');
}
