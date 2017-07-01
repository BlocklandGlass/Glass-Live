var log = function (...args) {
  var date = new Date();
  var str = "";

  for(var i in args) {
    str = str + "\t" + args[i];
  }

  str = str.substr(1);

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

  //23:01:23 9-25-16
  global.vorpal.log("[" +
    h + ":" + m + ":" + s + " " +
    fy + "-" + mo + "-" + da +
  "] ", str);
}

var error = function (...args) {
  var date = new Date();
  var str = "";

  for(var i in args) {
    str = str + "\t" + args[i];
  }

  str = str.substr(1);

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

  //23:01:23 9-25-16
  global.vorpal.log("[" +
    h + ":" + m + ":" + s + " " +
    fy + "-" + mo + "-" + da +
  "] ", str);
}

module.exports = {log, error};
