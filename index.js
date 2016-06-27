const net = require('net');
const database = require('./database.js');

var authId = []; //authId[key] = blid
var connectionByBlid = []; //connectionByBlid[blid] = connections[]

const clientServer = net.createServer((c) => { //'connection' listener
  c.on('end', () => {
    console.log('Client disconnected');
  });

  c.on('data', (data) => {
    var field = data.toString().trim().split('\t');

    if(field[0] == 'auth') {
      console.log('Client connected (' + field[1] + ', ' + field[2] + ')');

      var result = database.checkAuthFromIdent(field[1], c.remoteAddress);

      if(result.status == "success") {
        c.write('{"type":"auth", "status":"success"}\r\n');
        c.blid = result.blid;
      } else if(result.status = "failed") {
        console.log('Failed');
        c.write('{"type":"auth", "status":"failed"}\r\n');
        //c.
        return;
      }

      if(connectionByBlid[c.blid] == undefined)
        connectionByBlid[c.blid] = [];

      connectionByBlid[c.blid].push(c);

      pushNotification(c, "Glass Beta", "Welcome to the beta! Thanks for testing :)", "star", "5000", "");
      //pushNotification(c, "Blockoworld", "Blockoworld is happening RIGHT NOW! Click me for more information.", "bricks", "0", "");
    }
  });

  c.on('error', (err) => {
    console.error('Caught error', err);
  });

  c.write('hello\r\n');
});

const noteServer = net.createServer((c) => { //'connection' listener
  console.log('note connected');
  c.on('end', () => {
    console.log('note disconnected');
  });

  c.on('data', (data) => {
    obj = JSON.parse(data);

    if(obj.type == 'notification') {

      if(connectionByBlid[obj.target] == undefined) {
        console.log('target not found');
        return;
      }

      for(var i = 0; i < connectionByBlid[obj.target].length; i++) {
        con = connectionByBlid[obj.target][i];
        try {
          pushNotification(con, obj.title, obj.text, obj.image, obj.duration, obj.callback);
        } catch(err) {
          console.error('Caught error sending to client', err);
        }
      }
      console.log('sent notification to ' + i + ' receiptents');
    }
  });

  c.on('error', (err) => {
    console.error('Caught error', err);
  });
});

clientServer.listen(27000, () => { //'listening' listener
  console.log('Bound 27000');
});

noteServer.listen(27001, () => { //'listening' listener
  console.log('Bound 27001\r\n');
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
