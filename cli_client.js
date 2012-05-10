var Communication = require('./comm.js');
var Repository = require('./repository.js');
var repo_comm = require('./repo_comm.js');
var edit_seq = require('./edit_seq.js');
var readline = require('readline'),
  rl = readline.createInterface(process.stdin, process.stdout);

var repo = new Repository();
var comm, go;
rl.question("Username?", function(answer) {
  repo.setColor(answer);
  rl.question("Listen on port?", function(answer) {
    comm = new Communication(parseInt(answer));
    comm.init();
    repo.create_repository();
    repo_comm.useComm(comm, repo);
    repo.currentDocument.on('changed', function() {
      process.stdout.write("Current document:\n"+repo.currentDocument.text+"\n");
    });
    go();
  })
});

go = function() {
  rl.on('line', function(line) {
    while(line[line.length-1]=='\n' || line[line.length-1]=='\r') line=line.substring(0, line.length-1);
    var components = line.split(' ');
    var op, conn;
    var command = components[0].toLowerCase();
    if(command == 'insert') {
      op = edit_seq.op_insert(parseInt(components[1]), line.substring(components[0].length+1+components[1].length+1));
    } else if(command == 'delete'){
      op = edit_seq.op_delete(parseInt(components[1]), parseInt(components[2]));
    } else if(command == 'move') {
      op = edit_seq.op_move(parseInt(components[1]), parseInt(components[2]), parseInt(components[3]));
    } else if(command == 'connect') {
      conn = {action: 'connect', host: components[1], port: parseInt(components[2])};
    } else if(command == 'disconnect') {
      conn = {action: 'disconnect'};
    }
    if(op) {
      repo_comm.add_revision(repo, [op], comm);
    } else if(conn) {
      if(conn.action=='connect') {
        comm.connect(conn.host, conn.port);
      } else if(conn.action=='disconnect') {
        comm.disconnect_all();
      }
    } else {
      process.stdout.write("Invalid command.\n");
    }
  });
};