var printIconList = function() {
  var fs = require('fs');
  var Icons = require('./icons');

  var txt = "";
  for(i in Icons.allowed) {
    txt = txt + "\n" + Icons.allowed[i];
  }
  fs.writeFileSync('./icon_allowed.txt', txt.substr(1));

  txt = "";
  for(i in Icons.restricted) {
    txt = txt + "\n" + Icons.restricted[i];
  }
  fs.writeFileSync('./icon_restricted.txt', txt.substr(1));
}

module.exports = {printIconList};
