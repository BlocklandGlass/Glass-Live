const request = require('request');
const encoding = require('encoding');

const logger = require('./logger');

var check = function(ident, ip, callback) {
  if(ident.trim() == "") {
    callback(null, "No ident");
    return;
  }

  var url = "http://api.blocklandglass.com/api/3/authCheck.php?ident=" + ident + "&ip=" + ip;
  request(url, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      try {
        var obj = JSON.parse(body);
      } catch (e) {
        logger.error('Unable to parse auth for ident ' + ident);
        callback(null, e);
        return;
      }
      callback(obj, null);
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
