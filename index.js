const cli = require('./cli');
const chatServer = require('./chatServer');
const chatroom = require('./chatRoom');

chatServer.start();

chatroom.create("General Discussion", "tree")
  .setDefault(true);

chatroom.create("Help", "help");

chatroom.create("Servers", "server");

chatroom.create("Quality Assurance", "tree_red")
  .setRequirement('isBeta');

chatroom.create("Staff", "balance_unbalance")
  .setRequirement('isMod');
