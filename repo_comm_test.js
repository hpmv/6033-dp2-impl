var Communication = require('./comm.js');
var Repository = require('./repository.js');
var repo_comm = require('./repo_comm.js');
var edit_seq = require('./edit_seq.js');

var comm1 = new Communication(12345),
  comm2 = new Communication(23451);

var repo1 = new Repository(),
  repo2 = new Repository();

repo1.setColor("Alice");
repo2.setColor("Bob");

repo1.create_repository();
repo2.create_repository();

repo_comm.useComm(comm1, repo1);
repo_comm.useComm(comm2, repo2);


comm1.init();
comm2.init();

setTimeout(function(){
  repo_comm.add_revision(repo1, [edit_seq.op_insert(0, "Hello World!")], comm1);
  repo_comm.add_revision(repo2, [edit_seq.op_insert(0, "How are you?")], comm2);
}, 0);

setTimeout(function() {
  comm1.connect("127.0.0.1", 23451);

}, 1000);

setTimeout(function() {
  console.log(JSON.stringify(repo1.history.toPortable()));
  console.log(JSON.stringify(repo2.history.toPortable()));
  console.log(repo1.currentDocument.text);
  console.log(repo2.currentDocument.text);
}, 4000);