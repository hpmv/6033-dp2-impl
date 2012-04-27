var Repository = require('./repository.js');
var es = require('./edit_seq.js');
var op_insert = es.op_insert,
  op_delete = es.op_delete,
  op_move =es.op_move;

var repo = new Repository();
repo.setColor("user1");
repo.create_repository();
var rev1 = repo.new_revision([op_insert(1, 'abcdefghijklmn')]).rev;
var rev2 = repo.new_revision([op_delete(3, 5)]).rev;
repo.add_revision(rev1, [op_insert(8, '012')], 'user2/1', 'user2');
var result = repo.beginMerge('user2/1', 'user2');

repo.applyMerge(result);
console.log(repo.HEAD); //expected: user1/4
console.log(repo.currentDocument.text); //expected: abcfgh012ijklmn

repo.add_revision(repo.HEAD, [op_delete(7,10), op_move(1, 3, 5)], 'user2/2', 'user2');
repo.advanceHead('user2/2');
console.log(repo.HEAD); //expected: user2/2
console.log(repo.currentDocument.text); //expected: afgbch0jklmn
