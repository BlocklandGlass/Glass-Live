process.stdin.on('data', function (buffer) {
  var text = buffer.toString()
  console.log('received data:', text.toString());
  if (text === 'quit\n') {
    console.log("bye");
  }
});
