const request = require('request');
const encoding = require('encoding');

const logger = require('./logger');

var check = function(ident, ip, daa, callback) {
  if(ident.trim() == "") {
    callback(null, "No ident");
    return;
  }

  var url  = "http://api.blocklandglass.com";
  //var url  = "http://glass.local";
      url += "/api/3/authCheck.php?ident=" + ident + "&ip=" + ip;

  if(daa != undefined) {
	  url += "&daa=1";
	  logger.log("Is DAA!");
  } else {
	  logger.log("Not DAA!");
  }

  var options = {
	  method: 'post',
	  body: daa,
	  json: true,
	  url: url
  };
  request(options, function (error, response, body) {
    if (!error && response.statusCode == 200) {
		 
      callback(body, null);

    } else {
      if(error) {
        logger.error('Auth error for ident ' + ident);
        callback(null, error);
      } else {
        logger.error('Auth error for ident ' + ident + ', received ' + response.statusCode);
        callback(null, "Status: " + response.statusCode);
      }
    }
  });
}

module.exports = {check};
