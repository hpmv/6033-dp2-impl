var History = require('./history.js');
var Edge = require('./edge.js');
var Document = require('./document.js');
var xform = require('./edit_seq.js').transform;

var Repository = function() { //TODO: add precondition checks.
  this.history = new History();
  this.HEAD = null;
  this.currentDocument = null;
  this.color = null;
  this.merger = function(rev1, rev2) {
    var lca = this.history.getLCA(rev1, rev2); //TODO: implement this functionality
    var seq1 = this.history.getEditSequence(lca, rev1);
    var seq2 = this.history.getEditSequence(lca, rev2); //TODO: this is slow!
    var merged = xform(seq1, seq2);
    return {
      rev: this.genRevision(),
      e1: merged.op1,
      e2: merged.op2
    }; //TODO: implement user-driven conflict resolution
  };
  this.setColor = function(color) {
    this.color = color;
  };
  var _revNum = 1;
  this.genRevision = function() {
    return this.color + '/' + _revNum++;
  };
  this.create_repository = function() {
    var rev = this.genRevision();
    this.history.addRevision(rev);
    this.currentDocument = new Document();
    this.HEAD = rev;
    return rev;
  };
  this.new_revision = function(edit_seq) {
    var rev = this.genRevision();
    var parentRev = this.HEAD;
    this.history.addRevision(rev);
    this.history.addEdge(parentRev, rev, edit_seq, this.color);
    this.currentDocument.apply(edit_seq);
    var oldHEAD = this.HEAD;
    this.HEAD = rev;
    return {
      oldHEAD: oldHEAD,
      rev: rev
    };
  };
  this.add_revision = function(from, edit_seq, rev, color) {
    this.history.addRevision(rev);
    this.history.addEdge(from, rev, edit_seq, color);
    return true;
  };
  this.beginMerge = function(otherRev, otherColor) {
    var result = this.merger(this.HEAD, otherRev);
    this.history.addRevision(result.rev);
    this.history.addEdge(this.HEAD, result.rev, result.e1, this.color);
    result.otherRev = otherRev;
    result.otherColor = otherColor;
    result.myColor = this.color;
    result.oldHEAD = this.HEAD;
    this.currentDocument.apply(result.e1); //TODO: advance head here or when apply?
    this.HEAD = result.rev; //TODO: need recovery mechanism.
    return result;
  };
  this.applyMerge = function(mergeResult) {
    this.history.addEdge(mergeResult.otherRev, mergeResult.rev, mergeResult.e2, mergeResult.otherColor);
  };
  this.abortMerge = function(mergeResult) {
    this.history.removeRevision(mergeResult.rev);
    this.history.removeEdge(mergeResult.oldHEAD, mergeResult.rev);
  };
  this.receiveMerge = function(mergeResult, senderColor) {
    if(this.HEAD == mergeResult.otherRev) {
      this.history.addRevision(mergeResult.rev);
      this.history.addEdge(mergeResult.oldHEAD, mergeResult.rev, mergeResult.e1, senderColor);
      this.history.addEdge(mergeResult.otherRev, mergeResult.rev, mergeResult.e2, this.color);
      this.HEAD = mergeResult.rev;
      return true;
    } else {
      return false; //merge fail.
    }
  };

  this.advanceHead = function(partnerHEAD) {
    var lca = this.history.getLCA(this.HEAD, partnerHEAD);
    if(lca == this.HEAD) {
      var edit_seq = this.history.getEditSequence(lca, partnerHEAD);
      this.currentDocument.apply(edit_seq);
      this.HEAD = partnerHEAD;
    }//else do nothing. Either we're ahead, or we are on a different direction.
  };
};

module.exports = exports = Repository;