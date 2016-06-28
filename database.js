var checkAuthFromIdent = function checkAuthFromIdent(ident, ip) {
  var request = require('sync-request');
  var res = request('GET', "http://blocklandglass.com/api/2/authCheck.php?ident=" + ident)

  return JSON.parse(res.getBody());
}

module.exports = {
  checkAuthFromIdent: checkAuthFromIdent
}
