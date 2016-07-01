const net = require('net');
const database = require('./database');
const Chatroom = require('./chatroom');
const Client = require('./client');
const Users = require('./user');
const gd = new Chatroom('General Discussion');
const moment = require('moment');

const config = require('./config');

const clientServer = net.createServer((c) => { //'connection' listener
  c.on('end', () => {
    if(c.client != null)
      c.client.cleanUp();

    console.log('Client disconnected');
  });

  c.on('close', () => {
    if(c.client != null)
      c.client.cleanUp();

    console.log('Client disconnected');
  });

  c.on('data', (raw) => {
    var data = JSON.parse(raw);

    switch(data.type) {
      case "auth":
        var result = c.client.authCheck(data.ident);
        if(result) {
          console.log("Connected (" + c.client.blid + ", " + data.ident + ")");
          c.write('{"type":"auth", "status":"success"}\r\n');
          c.blid = c.client.blid;
          c.user = Users.getByBlid(c.client.blid);
          c.user.addClient(c.client);
          c.user.setUsername(c.client.username);
          c.client.sendFriendsList();
        } else {
          console.log('Failed');
          c.write('{"type":"auth", "status":"failed"}\r\n');
          return;
        }
        gd.addUser(c.client);

        // TODO send friend requests
        // TODO send pub room listing

        //gd.sendMessage(c.client, "hey guys!!!");
        break;

      case "roomChat":
        gd.sendMessage(c.client, data.message);
        break;

      case "roomLeave":
        gd.removeUser(c.client, 0);
        break;

      case "roomJoin":
        gd.addUser(c.client);
        break;

      case "message":
        target = Users.getByBlid(data.target);
        obj = {
          "type": "message",
          "message": data.message,
          "sender": c.client.username,
          "sender_id": c.blid,
          "timestamp": moment().unix(),
          "datetime": moment().format('h:mm:ss a')
        };
        target.messageClients(JSON.stringify(obj));
        break;

      case "locationUpdate":
        if(data.action == "playing") {
          c.client.setLocation(data.action, data.location);
        } else {
          c.client.setLocation(data.action);
        }
        break;

      case "friendRequest":
        target = Users.getByBlid(data.target);
        target.newFriendRequest(c.user);
        break;

      case "friendAccept":
        c.user.acceptFriend(data.blid);
        break;

      default:
        console.log("unhandled");
    }
      //pushNotification(c, "Connected", "Connected to Glass Notification server", "star", "5000", "");
      //pushNotification(c, "Blockoworld", "Blockoworld is happening RIGHT NOW! Click me for more information.", "bricks", "0", "");
  });

  c.on('error', (err) => {
    if(err == 'EPIPE') {
    } else {
      console.error('Caught error', err);
    }
    c.client.cleanUp();
  });

  c.client = new Client(c);
});

const noteServer = net.createServer((c) => { //'connection' listener
  console.log('note connected');
  c.on('end', () => {
    console.log('note disconnected');
  });

  c.on('data', (data) => {
    obj = JSON.parse(data);

    if(obj.type == 'notification') {
      user = Users.getByBlid(obj.target);
      dat = {
        "type":"notification",
        "title":obj.title,
        "text":obj.text,
        "image":obj.image,
        "duration":obj.duration,
        "callback":obj.callback
      };
      user.messageClients(JSON.stringify(dat));
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
  console.log('Bound ' + (config.basePort+1) + '\r\n');
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
