const cli = require('./cli');
const chatServer = require('./chatServer');
const chatroom = require('./chatRoom');

chatServer.start();

global.gd = chatroom.create("General Discussion", "tree");
