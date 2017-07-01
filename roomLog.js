const fs = require('fs');

var logEvent = function(id, type, body) {
  while(type.length < 6) {
    type = type + ' ';
  }
  
  var line = getDateString();
  line    += "\t" + type;
  line    += "\t" + body.replace("\n", "\\n").replace("\t", "\\t");

  fs.appendFile(__dirname + '/log/' + id + '-room.log', line + '\n', function (err) {
    //if (err) throw err;
  });
}

var getDateString = function() {
  var date = new Date();

  var h = String(date.getHours());
  var m = String(date.getMinutes());
  var s = String(date.getSeconds());

  var fy = String(date.getFullYear());
  var mo = String((date.getMonth()+1));
  var da = String(date.getDate());

  if(h.length == 1) {
    h = "0" + h;
  }

  if(m.length == 1) {
    m = "0" + m;
  }

  if(s.length == 1) {
    s = "0" + s;
  }

  if(mo.length == 1) {
    mo = "0" + mo;
  }

  if(da.length == 1) {
    da = "0" + da;
  }

  return "[" +
    h + ":" + m + ":" + s + " " +
    fy + "-" + mo + "-" + da +
  "]";
}

const mkdirp = require('mkdirp');

mkdirp.sync(__dirname + '/log/');
try {
  fs.chmodSync(__dirname + '/log/', '0777');
} catch(e) {}

module.exports = {logEvent};
