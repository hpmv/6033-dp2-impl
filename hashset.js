var HashSet = function() {
  this.c = {};
  this.add = function(i) {
    this.c[i] = i;
  };
  this.has = function(i) {
    return i in this.c;
  };
  this.remove = function(i) {
    delete this.c[i];
  };
  this.all = function() {
    var values = [];
    for(var x in this.c) {
      values.push(this.c[x]);
    }
    return values;
  }
};

module.exports = exports = HashSet;