var vorpal = require('vorpal')();
global.vorpal = vorpal;

vorpal
  .delimiter('live~');

vorpal.command('startServer', 'Starts Blockland server').action(function(args, callback) {
  require('./blocklandWrapper').startServer();
  callback();
});

vorpal.command('killServer', 'Forcefully stops Blockland server').action(function(args, callback) {
  require('./blocklandWrapper').killServer();
  callback();
});
