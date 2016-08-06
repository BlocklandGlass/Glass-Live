module.export = Groupchat;

var createGroup = function(owner, clients, callback) {
  if(clients.length < 2) {
    callback(false, null);
  } else {
    var gc = new Groupchat(owner, clients);
    callback(true, gc);
  }
}

var groupIndex = 0;

function Groupchat(owner, clients) {
  this.id = groupIndex;
  this.owner = owner;

  this.addClient(owner);
  for(var i = 0; i < clients.length; i++) {
    this.inviteBlid(clients[i], owner);
  }

  groupList[this.id] = this;
}

Groupchat.prototype.addClient = function(client) {
  if(this.clients.indexOf(client) > -1)
    return;

  var clientArray = [];
  for(var i = 0; i < this.clients.length; i++) {
    o = {
      "username": this.clients[i].username,
      "blid": this.clients[i].blid
    };

    if(this.owner.blid == this.clients[i].blid)
      o.owner = true;

    clientArray.push(o);
  }

  data = {
    "type": "groupJoin",
    "id": this.id,
    "clients": clientArray
  };

  client.write(JSON.stringify(data) + '\r\n');

  data = {
    "type": "groupClientEnter",
    "id": this.id,
    "username": client.username,
    "blid": client.blid
  };

  this.writeAll(JSON.stringify(data));

  this.clients.push(client);
}

Groupchat.prototype.inviteBlid = function(blid, inviter) {
  Users.get(blid, function(user) {
    var client = user.getPrimaryClient();
    if(client != false) {
      this.inviteClient(client, inviter);
    } else {
      this.pushText(user.username @ " is offline");
    }
  }.bind({inviter: inviter}));
}

Groupchat.prototype.inviteClient = function(client, inviter) {
  if(this.clients.indexOf(client) > -1)
    return;

  if(this.clients.indexOf(inviter) == -1)
    return;

  data = {
    "type": "groupInvite",
    "id": this.id,
    "inviterName": inviter.username,
    "inviterBlid": inviter.blid,
    "size": this.clients.length
  };

  this.invitees.push(client.blid);

  client.write(JSON.stringify(data) + '\r\n');
}

Groupchat.prototype.acceptInvitation = function(client) {
  var idx = this.invitees.indexOf(client.blid);
  if(idx == -1)
    return;

  this.invitees.splice(idx, 1);
  this.addClient(client);
}

Groupchat.prototype.sendMessage = function(sender, message) {
  data = {
    "type": "groupMessage",
    "id": this.id,
    "senderName": sender.username,
    "senderBlid": sender.blid,
    "msg": message
  };

  this.writeAll(JSON.stringify(data));
}

Groupchat.prototype.writeAll = function(str) {
  for(var i = 0; i < this.clients.length; i++) {
    client = this.clients[i];
    client.write(str + '\r\n');
  }
}

Groupchat.prototype.clientLeave = function(client, reason) {
  var idx = this.clients.indexOf(client);
  if(idx == -1)
    return;

  this.clients.splice(idx, 1);

  if(reason == null)
    reason = -1;

  data = {
    "type": "groupClientLeave",
    "id": this.id,
    "blid": sender.blid,
    "reason": reason
  };

  this.writeAll(JSON.stringify(data));
}

module.export = {createGroup: createGroup}
