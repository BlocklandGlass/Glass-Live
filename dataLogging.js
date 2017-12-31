const fs = require('fs');

var logRoomEvent = function(id, type, body) {
  var line = Date.now();
  line    += "\t" + type;
  line    += "\t" + body.replace("\n", "\\n").replace("\t", "\\t");

  var file = getRoomWriteFile(id);

  fs.appendFile(file, line + '\n', function (err) {
    //if (err) throw err;
  });
}

var logUserEvent = function(blid, ...args) {
  //types
  // connection.auth.start <ip> <version>
  // connection.auth.result <result> <username>
  // connection.close <message?>
  //
  // room.join <id>
  // room.message <id> <message>
  // room.leave <id>
  // room.kicked <id> <reason>
  //
  // rooms.banned <duration> <reason>
  var line = Date.now();

  for(var i in args) {
    var arg = args[i];
    arg.replace('\t', '\\t');
    arg.replace('\n', '\\n');

    line = line + '\t' + args[i]
  }

  var file = getUserWriteFile(blid);

  fs.appendFile(file, line + '\n', function (err) {
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

var getRoomWriteFile = function(id, time = null) {
  //gets the appropriate write file based on date
  var date;
  if(time == null) {
    date = new Date();
  } else {
    date = new Date(time);
  }

  var fy = String(date.getFullYear());
  var mo = String((date.getMonth()+1));
  var da = String(date.getDate());

  var dateStr = fy + '-' + mo + '-' + da;

  var folder = __dirname + '/log/room/' + id + '/';
  var file  = folder + dateStr + '.log';

  mkdirp.sync(folder);
  return file;
}

var getUserWriteFile = function(id, time = null) {
  //gets the appropriate write file based on date
  var date;
  if(time == null) {
    date = new Date();
  } else {
    date = new Date(time);
  }

  var fy = String(date.getFullYear());
  var mo = String((date.getMonth()+1));
  var da = String(date.getDate());

  var dateStr = fy + '-' + mo + '-' + da;

  var folder = __dirname + '/log/user/' + id + '/';
  var file  = folder + dateStr + '.log';

  mkdirp.sync(folder);
  return file;
}

const mkdirp = require('mkdirp');

mkdirp.sync(__dirname + '/log/');
try {
  fs.chmodSync(__dirname + '/log/', '0777');
} catch(e) {}

module.exports = {logRoomEvent, logUserEvent};
