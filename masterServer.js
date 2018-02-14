const logger = require('./logger');
const http = require('http');

module.servers = {};

var getFromAddress = function(addr, cb) {
  if(module.servers[addr] != undefined) {
    cb(module.servers[addr], null);
  } else {
    logger.log("Forcing master server query...");
    queryMasterServer(function(err) {
      if(err != null) {
        cb(null, 'Query failed');
      }

      if(module.servers[addr] != undefined) {
        cb(module.servers[addr], null);
      } else {
        cb(false, null);
      }
    })
  }
}

var startQueryTimer = function() {
  if(module.queryTimer != undefined) {
    clearTimeout(module.queryTimer);
  }

  module.queryTimer = setTimeout(function() {
    logger.log("Scheduled master server query...");
    queryMasterServer();
  }, 60*1000);
}

var queryMasterServer = function(cb) {
  http.get({
    hostname: 'master2.blockland.us',
    port: 80,
    path: '/',
    agent: false
  }, (res) => {

    var rawData = '';
    res.on('data', (chunk) => rawData += chunk)

    res.on('error', () => {
      logger.log("Error querying master server!");
		cb(e);
	 });

    res.on('end', () => {
      try {
        var servers = {};
        var playerSum = 0;

        var start = false;
        var lines = rawData.toString().split('\n');
        for(var i in lines) {
          var line = lines[i].trim();
          if(line == "START") {
            start = true;
            continue;
          }

          if(line == "END") {
            start = false;
            break;
          }

          if(!start) {
            continue;
          }

          var field = line.split('\t');
          var server = new ServerInfo(field[0], field[1], field[4], (field[3] == 1), (field[2] == 1), field[5], field[6], field[7]);
          if(field.length != 9) {
            logger.log("abnormal: " + line);
          }

          playerSum += parseInt(field[5]);

          servers[server.getAddress()] = server;
        }

        for(var i in module.servers) {
          if(servers[i] != undefined) {
            module.servers[i] = null;
          } else {
            module.servers[i].didShutdown();
          }
        }

        module.servers = servers;

        if(cb != null) {
          cb(null);
        }

        //logger.log("Master Server query done (" + Object.keys(servers).length + " servers, " + playerSum +  " players)");
        startQueryTimer();

      } catch (e) {
        if(cb != null)
          cb(e.message);

        logger.error(e.message);
      }
    });
  }).on('error', function(e) {
    logger.error("Master Server Query Failed: " + e);
    startQueryTimer();
    cb(e.message)
  })
}

function ServerInfo(ip, port, title, dedicated, passworded, players, maxPlayers, gamemode) {
  this.ip = ip;
  this.port = port;

  this.title = title;

  this.dedicated = dedicated;
  this.passworded = passworded;

  this.players = players;
  this.maxPlayers = maxPlayers;

  this.gamemode = gamemode;

  //logger.log(this.getTitle() + ' is being hosted at ' + this.getAddress());
}

ServerInfo.prototype.getAddress = function() {
  return this.ip + ':' + this.port;
}

ServerInfo.prototype.getTitle = function() {
  return this.title;
}

ServerInfo.prototype.didShutdown = function() {
  logger.log(this.getTitle() + ' is no longer online');
}

if(require.main === module) {
  queryMasterServer();
}

module.exports = {startQueryTimer, getFromAddress, queryMasterServer};
