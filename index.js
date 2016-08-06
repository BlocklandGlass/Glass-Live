const net = require('net');
const database = require('./database');

const Chatrooms = require('./chatroom');
const Client = require('./client');
const Users = require('./user');

const moment = require('moment');
const serverlist = require('./serverlist');
const connections = require('./connections');
const config = require('./config');

global.uptime = moment().unix();

require('./commandline');

//================================
// Chatrooms
//================================

const gd = Chatrooms.createChatroom('General Discussion', 'tree');
Chatrooms.createChatroom('Servers', 'server');
Chatrooms.createChatroom('Help', 'help');

const staffRoom = Chatrooms.createChatroom('Staff', 'balance_unbalance');
staffRoom.userRequirement = "mod";

const qaRoom = Chatrooms.createChatroom('Quality Assurance', 'tree_red');
qaRoom.userRequirement = "beta";


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
