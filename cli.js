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

vorpal.command('killServer', 'Forcefully stops Blockland server').action(function(args, callback) {
  require('./blocklandWrapper').killServer();
  callback();
});
