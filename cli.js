const logger = require('./logger')

var vorpal = require('vorpal')();
global.vorpal = vorpal;

vorpal
  .delimiter('live~')
  .show();

vorpal.command('kickClient <blid> [reason...]', 'Kicks client from glass live').action(function(args, callback) {
  var cc = require('./clientConnection');
  var client;
  if((client = cc.getFromBlid(args.blid))) {
    client.kick(args.reason.join(' '));
  }
  callback();
});

vorpal.command('listClients', 'Shows clients online').action(function(args, callback) {
  var clients = require('./clientConnection').getAll();
  var ct = 0;
  for(var i in clients) {
    ct++;
    var cl = clients[i];
    logger.log(cl.username + '\t' + cl.blid + '\t' + cl.socket.remoteAddress);
  }
  logger.log('Displayed ' + ct + ' users');
  callback();
});

vorpal.command('shutdown <timeout> [reason...]', 'Issues a \'shutdown\' call to all clients. Client reconnect timeout in seconds').action(function(args, callback) {
  var reason;
  if(args.reason == null) {
    reason = "";
  } else {
    reason = args.reason.join(' ');
    reason.trim();
  }

  require('./chatServer').shutdown();

  require('./clientConnection').sendObjectAll({
    type: 'shutdown',
    planned: true,
    reason: reason,
    timeout: args.timeout*1000
  });

  require('./dataLogging').logGlobalRoomEvent('sys', 'Planned shutdown initiated.');
  logger.log('Quitting...');
  setTimeout(function() {
    process.exit(0);
  }, 1000);

  callback();
});
