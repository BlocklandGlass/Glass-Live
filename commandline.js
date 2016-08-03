
const Clients = require('./client.js');

process.stdin.on('data', function (buffer) {
  var text = buffer.toString().trim()
  var word = text.split(' ');

  switch (word[0].toLowerCase()) {
    case "quit":
      console.log("Quitting...");

      process.exit()
      break;

    case "serverupdate":
      obj = {
        "type": "shutdown",
        "planned": true,
        "timeout": 5000,
        "reason": "Glass Live is going offline for a quick update"
      };

      console.log("[server] Notifying clients...");
      Clients.broadcast(JSON.stringify(obj));
      console.log("[server] Shutting Down")
      process.exit()
      break;

    case "help":
      func = [
        "serverupdate <duration>"
      ];

      console.log("======== Help: ========");
      for(var i = 0; i < func.length; i++) {
        console.log(func[i]);
      }
      console.log("======== ===== ========");
      break;

    default:

  }
});
