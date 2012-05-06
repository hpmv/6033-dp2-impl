var HashSet = require('./hashset.js');
var Edge = require('./edge.js');
var Queue = require('./Queue.js');


var History = function () {
  this.revisions = new HashSet();
  this.parents = {};
  this.children = {};
  this.addRevision = function (rev) {
    if (this.revisions.has(rev)) return;
    this.revisions.add(rev);
    this.parents[rev] = [];
    this.children[rev] = [];
  };
  this.addEdge = function (parentRev, childRev, data, color) {
    var edge = new Edge(parentRev, childRev, data, color);
    var parents = this.parents[childRev];
    for(var i=0;i<parents.length;i++){
      if(parents[i] == parentRev)
        return;
    }
    parents.push(parentRev);
    this.children[parentRev].push(edge);
  };
  this.removeEdge = function (parentRev, childRev) {
    var parents = this.parents[childRev];
    for (var i = 0; i < parents.length; i++) {
      if (parents[i] == parentRev) {
        parents.splice(i, 1);
        break;
      }
    }
    var children = this.children[parentRev];
    for (var i = 0; i < children.length; i++) {
      if (children[i].childRev == childRev) {
        children.splice(i, 1);
        break;
      }
    }
  };
  this.removeRevision = function (rev) {
    this.revisions.remove(rev);
  };

  this.getEdgesFrom = function (rev) {
    return this.children[rev];
  };
  this.getParents = function (rev) {
    return this.parents[rev];
  };

  /**
   * Gets the composed edit sequence from one revision to another.
   * Algorithm runs in O(E+V).
   * @param from the older revision
   * @param to the newer revision
   */
  this.getEditSequence = function (from, to) {
    if (from == to) return [];
    var visited = {};
    var q = new Queue();
    q.enqueue({node:from, seq:[]});
    visited[from] = true;
    while (!q.isEmpty()) {
      var ele = q.dequeue();
      var children = this.children[ele.node];
      for(var i=0;i<children.length;i++){
        var next = children[i];
        if (!visited[next.childRev]) {
          visited[next.childRev] = true;
          var newseq = [].concat.apply([], [ele.seq, next.data]);
          if (next.childRev == to) {
            return newseq;
          }
          q.enqueue({node:next.childRev, seq:newseq});
        }
      }
    }
  };

  this.getLCA = function (rev1, rev2) {
    if (rev1 == rev2) return rev1;
    var visited = {};
    var parents = this.parents;
    (function dfs(rev) {
      visited[rev] = true;
      parents[rev].forEach(function (parent) {
        if (!visited[parent]) {
          dfs(parent);
        }
      });
    })(rev1);
    if (visited[rev2]) return rev2;
    var visited2 = {};
    var q = new Queue();
    q.enqueue(rev2);
    visited2[rev2] = true;
    while (!q.isEmpty()) {
      var ele = q.dequeue();
      var p = parents[ele];
      for(var i=0;i<p.length;i++){
        var parent =p[i];
        if (!visited2[parent]) {
          visited2[parent] = true;
          if (visited[parent]) {
            return parent;
          }
          q.enqueue(parent);
        }
      }
    }
    throw "No LCA found. rev1: " + rev1 + ", rev2: " + rev2;
  };
  this.toPortable = function() {
    var revisions = this.revisions.all();
    var edges = [];
    for(var rev in this.children) {
      edges = edges.concat(this.children[rev]);
    }
    return {
      revisions: revisions,
      edges: edges
    };
  }

};

module.exports = exports = History;