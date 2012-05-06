var Repository = require('./repository.js');
var History = require('./history.js');
var Edge = require('./edge.js');

function add_revision(repo, edit_seq, comm) {
  //TODO: queue requests. Also, figure out whether there is currently a merge waiting. Need to queue them.
  //TODO: the queue must be able to batch up revisions so they must not commit to the repository before
  //      being released.
  var feedback = repo.new_revision(edit_seq);
  var targets = comm.all_connections();
  targets.forEach(function(target) {
    comm.send(target, {
      action: 'add',
      oldHEAD: feedback.oldHEAD,
      rev: feedback.rev,
      edit_seq: edit_seq,
      color:repo.color
    });
  });
}

function receive_add_revision(repo, origin, oldHEAD, rev, edit_seq, color, comm) {
  if(origin == comm.master()) {
    //just add.
    repo.add_revision(oldHEAD, edit_seq, rev, color);
    repo.advanceHead(rev);
    //board cast?
    comm.slaves().forEach(function(target) {
      comm.send(target, {
        action: 'add',
        oldHEAD: oldHEAD,
        rev: rev,
        edit_seq: edit_seq,
        color: color
      });
    });
  } else {
    //sent by slave. Need to figure out whether merging is necessary.
    repo.add_revision(oldHEAD, edit_seq, rev, color);
    repo.advanceHead(rev);
    if(repo.HEAD == rev) {
      //good. No merging needed. Treat it as if it was a server edit.
      comm.all_connections().forEach(function(target) {
        if(target == origin) return;
        comm.send(target, {
          action: 'add',
          oldHEAD: oldHEAD,
          rev: rev,
          edit_seq: edit_seq,
          color: color
        });
      });
      comm.send(origin, {
        action: 'add_ack'
      });
    } else {
      //Merge the two revisions.
      var mergeResult = repo.beginMerge(rev, color);
      comm.send(origin, {
        action: 'merge',
        mergeResult: mergeResult
      });
      comm.send(origin, {
        action: 'add_ack'
      });
    }

  }
}

function receive_merge(repo, origin, mergeResult, comm) {
  if(repo.HEAD != mergeResult.otherRev) {
    //Problematic.
    throw "Merge failed. Old head: "+repo.HEAD+ " != otherRev: "+mergeResult.otherRev;
  }
  repo.receiveMerge(mergeResult);
  comm.send(origin, {
    action: 'merge_ack',
    mergeResult: mergeResult

  });
}

function receive_merge_ack(repo, origin, mergeResult, comm) {
  repo.applyMerge(mergeResult);
  //Advertise the merge to all other connections.
  comm.all_connections().forEach(function(target) {
    if(target==origin) return;
    comm.send(target, {
      action: "merge_adv",
      mergeResult: mergeResult
    });
  });
  //TODO: release queue.
}

function receive_merge_adv(repo, origin, mergeResult, comm) {
  repo.add_revision(mergeResult.otherRev, mergeResult.e2, mergeResult.rev, mergeResult.otherColor);
  repo.add_revision(mergeResult.oldHEAD, mergeResult.e1, mergeResult.rev, mergeResult.myColor); //TODO: forwarding?
}

function synchronize(repo, target, comm) {
  comm.send(target, {
    action: "synchronize",
    history: repo.history.toPortable(),
    color: repo.color,
    head: repo.HEAD
  });
}

function receive_synchronize(repo, origin, history, color, head, comm) {
  repo.synchronize(history, color, head);
  if(comm._master != origin) {
    if(repo.HEAD != head) {
      var mergeResult = repo.beginMerge(head, color);
      comm.send(origin, {
        action: 'merge',
        mergeResult: mergeResult
      });
    }
    comm.send(origin, {
      action: 'connection_ready'
    });
    comm.ready(origin);
  }
}



function useComm(comm, repo) {
  comm.on('data', function(origin, data) {
    var action = data.action;
    if(action=='add') {
      receive_add_revision(repo, origin, data.oldHEAD, data.rev, data.edit_seq, data.color, comm);
    } else if(action=='merge') {
      receive_merge(repo, origin, data.mergeResult, comm);
    } else if(action=='merge_ack') {
      receive_merge_ack(repo, origin, data.mergeResult, comm);
    } else if(action=='merge_adv') {
      receive_merge_adv(repo, origin, data.mergeResult, comm);
    } else if(action=='add_ack') {
      //TODO: add ack.
    } else if(action=='synchronize') {
      receive_synchronize(repo, origin, data.history, data.color, data.head, comm);
    } else if(action=="connection_ready") {
      comm.ready(origin);
    }
  });
  comm.on('new_slave', function(conn) {
    synchronize(repo, conn, comm);
  });
  comm.on('master_connected', function(conn) {
    synchronize(repo, conn, comm);
  })
}

module.exports = exports = {
  add_revision: add_revision,
  receive_add_revision: receive_add_revision,
  receive_merge: receive_merge,
  receive_merge_ack: receive_merge_ack,
  receive_merge_adv: receive_merge_adv,
  synchronize: synchronize,
  receive_synchronize: receive_synchronize,
  useComm:useComm
};