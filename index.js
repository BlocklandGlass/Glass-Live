const cli = require('./cli');
const chatServer = require('./chatServer');
const chatroom = require('./chatRoom');
const masterServer = require('./masterServer');

chatServer.start();

chatroom.create("General Discussion", "tree")
  .setDefault(true);

chatroom.create("Help", "help");

chatroom.create("Servers", "server");

chatroom.create("Quality Assurance", "tree_red")
  .setRequirement('isBeta')
  .setGlassBot(false);

chatroom.create("Staff", "balance_unbalance")
  .setRequirement('isMod')
  .setGlassBot(false);

masterServer.queryMasterServer();

require('./dataLogging').logGlobalRoomEvent('sys', 'Now accepting connections.');