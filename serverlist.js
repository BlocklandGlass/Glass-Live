const request = require('request');
const Clients = require('./client.js');

var serverList = [];

function ServerListing() {

}

ServerListing.prototype.checkForChanges = function(data) {
  tracked = [
    "players",
    "maxplayers",
    "brickcount",
    "mapname",
    "passworded"
  ];

  for(var i = 0; i < tracked.length; i++) {
    key = tracked[i];
    if(data[key] != this[key]) {
      this[key] = data[key];
      this.onUpdate(key);
    }
  }
}

ServerListing.prototype.onUpdate = function(key) {
  //console.log('[update] [' + this.ip + ' ' + this.port + '] ' + key + ' ' + this[key])
  obj = {
    "type": "serverListUpdate",
    "ip": this.ip,
    "port": this.port,
    "key": key,
    "value": this[key]
  };

  Clients.broadcast(JSON.stringify(obj));
}

var getServer = function(ip, port) {
  if(serverList[ip + " " + port] != null) {
    return serverList[ip + " " + port];
  } else {
    return false;
  }
}

var addServer = function(ip, port, listing) {
  serverList[ip + " " + port] = listing;
}

var doUpdate = function () {
  request('http://master2.blockland.us/', function (error, response, body) {
    if (!error && response.statusCode == 200) {
      lines = body.split("\r\n");
      servers = [];
      fieldNames = [];
      for(var i = 0; i < lines.length; i++) {
        line = lines[i].trim();
        fields = line.split("\t");

        if(fields[0] == "START")
          continue;

        if(fields[0] == "END")
          break;

        if(fields[0] == "FIELDS") {
          for(var j = 1; j < fields.length; j++) {
            fieldNames[j-1] = fields[j].toLowerCase();
          }
          continue;
        }

        server = new ServerListing;
        for(var j = 0; j < fields.length; j++) {
          server[fieldNames[j]] = fields[j];
        }
        servers.push(server);
      }

      notFound = serverList.splice(0);
      for(var i = 0; i < servers.length; i++) {
        server = servers[i];

        listing = getServer(server.ip, server.port);
        if(listing == false) {
          //console.log("new server [" + server.ip + " " + server.port + "]")
          addServer(server.ip, server.port, server);
        } else {
          listing.checkForChanges(server);
        }

        delete notFound[server.ip + " " + server.port];
      }

      for(var i = 0; i < notFound.length; i++) {
        server = notFound[i];
        //console.log("server missing [" + server.ip + " " + server.port + "]")
        delete server;
      }
    }
  })
}

setInterval(doUpdate, 10000);
doUpdate();
