const moment = require('moment');

const logger = require('./logger');

module.chats = [];

function Groupchat(owner, invites) {
  this.owner = owner.blid;
  this.id = _getNextIndex();

  this.clients = [];
  this.invites = [];
  this.blids = [];

  this.addClient(owner);
}

var create = function(owner, invites) {
  var group = new Groupchat(name, invites);

  logger.log("Created group id " + group);

  module.chats[group.id] = group;

  for(i in invites) {
    var invite = invites[i];
    group.inviteClient(invite);
  }

  group.addClient(owner);

  return group;
}

var _getNextIndex = function() {
  for(i in module.chats) {
    var chat = nodule.chats[i];
    if(chat == null) {
      return i;
    }
  }

  return modules.chats.length;
}

var getFromId = function(id) {
  if(module.chats == null)
    module.chats = [];

  if(module.chats[id] == null)
    return false;

  return module.chats[id];
}

Groupchat.prototype.addClient = function(client) {
  var group = this;

  var idx = group.clients.indexOf(client);
  if(idx > -1) {
    group.clients.splice(idx, 1);
  }

  client.sendObject({
    type: "groupJoin",
    id: group.id,
    owner: group.owner,

    clients: group.getClientList()
  });

  group.clients.push(client);

  group.sendObject({
    type: "groupUserJoin",
    id: group.id,

    username: client.username,
    blid: client.blid,

    status: client.status,
    icon: client.getIcon()
  });

  client._didEntergroup(group.id);
}

Groupchat.prototype.inviteClient = function(client, inviter) {
  var group = this;

  var idx = group.clients.indexOf(client);
  if(idx > -1) {
    //user already here?
    return;
  }

  var idx = group.blids.indexOf(client.blid);
  if(idx > -1) {
    group.blids.splice(idx, 1);
  }

  var obj = {
    type: "groupInvite",
    id: group.id,
    owner: group.owner,

    clients: group.getClientList()
  };

  if(inviter != null) {
    obj.inviter = inviter.getReference();
  }

  client.sendObject(obj);

  group.blids.push(client.blid);

  group.sendObject({
    type: "groupUserInvited",
    id: group.id,

    username: client.username,
    blid: client.blid,

    status: client.status,
    icon: client.getIcon()
  });

  client._didEntergroup(group.id);
}

Groupchat.prototype.clientExit = function(client, reason) {
  var group = this;
  if(reason == null)
    reason = -1;

  var idx = group.clients.indexOf(client);
  if(idx > -1) {
    group.clients.splice(idx, 1);
  } else {
    return false;
  }

  group.sendObject({
    type: "groupUserExit",
    id: group.id,

    blid: client.blid,
    reason: reason
  });

  if(group.clients.length == 0) {
    group.onEmpty();
  }

  //client._didLeaveGroup(group.id);
}


Groupchat.prototype.clientLeave = function(client, reason) {
  var group = this;
  if(reason == null)
    reason = -1;

  var idx = group.clients.indexOf(client);
  if(idx > -1) {
    group.clients.splice(idx, 1);
  } else {
    return false;
  }

  group.sendObject({
    type: "groupUser",
    id: group.id,

    blid: client.blid,
    reason: reason
  });

  if(group.clients.length == 0) {
    group.onEmpty();
  }

  //client._didLeaveGroup(group.id);
}

Groupchat.prototype.getClientList = function() {
  var group = this;
  var clientList = [];
  for(i in group.clients) {
    var client = group.clients[i];
    clientList.push(client.getReference());
  }

  return clientList;
}

Groupchat.prototype.sendObject = function(obj) {
  var group = this;
  for(i in group.clients) {
    var client = group.clients[i];
    client.sendObject(obj);
  }
}

Groupchat.prototype.sendClientMessage = function(client, msg) {
  var group = this;
  group.sendObject({
    type: "groupMessage",
    group: group.id,

    sender: client.username,
    sender_id: client.blid,

    msg: msg,

    timestamp: moment().unix(),
    datetime: moment().format('h:mm:ss a')
  });
}

Groupchat.prototype.onEmpty = function() {
  var group = this;
  module.chats[group.id] = null;
  logger.log("Destroying " + group.id + ", is empty");
  delete group;
}

module.exports = {create, getFromId};
