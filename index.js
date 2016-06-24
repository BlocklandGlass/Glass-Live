const net = require('net');

const devMode = true;

var authId = []; //authId[key] = blid
var connectionByBlid = []; //connectionByBlid[blid] = connections[]

const clientServer = net.createServer((c) => { //'connection' listener
  console.log('client connected');
  c.on('end', () => {
    console.log('client disconnected');
  });

  c.on('data', (data) => {
    var field = data.toString().split('\t');

    if(field[0] == 'auth') {
      console.log('authing...');
      if(authId[field[1]] != undefined) {
        c.blid = authId[field[1]];
      } else if(devMode) {
        c.blid = 9789;
      } else {
        console.log('auth failed');
        c.write('auth\tfailed\r\n');
        c.delete();
        return;
      }

      console.log('authed as ' + c.blid);
      c.write('auth\tsuccess\r\n');
      if(connectionByBlid[c.blid] == undefined)
        connectionByBlid[c.blid] = [];

      connectionByBlid[c.blid].push(c);
    }
  });

  c.write('hello\r\n');
});

const noteServer = net.createServer((c) => { //'connection' listener
  console.log('note connected');
  c.on('end', () => {
    console.log('note disconnected');
  });

  c.on('data', (data) => {
    //notification \t blid \t header \t text \t image \t action \t sticky
    var field = data.toString().split('\t');

    if(field[0] == 'notification') {
      console.log('receiving notification');

      if(connectionByBlid[field[1]] == undefined) {
        console.log('target not found');
        return;
      }

      for(var i = 0; i < connectionByBlid[field[1]].length; i++) {
        con = connectionByBlid[field[1]][i];
        try {
          con.write(data.toString() + '\r\n');
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
  console.log('client server bound');
});

noteServer.listen(27001, () => { //'listening' listener
  console.log('note server bound');
});
