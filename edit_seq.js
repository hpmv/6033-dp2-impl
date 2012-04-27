var Document = require('./document.js');

var op_insert = function (pos, text) {
  return new Operation("insert", {pos:pos, text:text});
};
var op_delete = function (begin, end) {
  return new Operation('delete', {begin:begin, end:end});
};
var op_move = function (begin, end, target) {
  return new Operation('move', {begin:begin, end:end, target:target});
};
var Operation = function (op, data) {
  this.op = op;
  this.data = data;
};
var pair = function (op1, op2) {
  return op1 + '.' + op2;
};
var lookup_table = {};

(function () {
  var xform = function (op1, op2, f) {
    lookup_table[pair(op1, op2)] = f;
    if (op1 != op2) {
      lookup_table[pair(op2, op1)] = function (data1, data2, callback) {
        return f(data2, data1, function (a, b, c) {
          callback(b, a, c);
        });//symmetric
      };
    }
  };
  xform('insert', 'insert', function (data1, data2, callback) {
    if (data1.pos < data2.pos) {
      callback(op_insert(data2.pos + data1.text.length, data2.text), op_insert(data1.pos, data1.text), false);
    } else if (data1.pos > data2.pos) {
      callback(op_insert(data2.pos, data2.text), op_insert(data1.pos + data2.text.length, data1.text), false);
    } else {
      callback(op_insert(data2.pos + data1.text.length, data2.text), op_insert(data1.pos, data1.text), true); //conflict
    }
  });
  xform('insert', 'delete', function (data1, data2, callback) {
    var pos = data1.pos, begin = data2.begin, end = data2.end, text = data1.text;
    if (pos <= begin) {
      callback(op_delete(begin + text.length, end + text.length), op_insert(pos, text), false);
    } else if (pos >= end) {
      callback(op_delete(begin, end), op_insert(pos - (end - begin), text), false);
    } else {
      callback(op_delete(begin, end + text.length), null, true); //conflict
    }
  });
  xform('delete', 'delete', function (data1, data2, callback) {
    var zap = function (begin, end, z) {
      if (z < begin) return z;
      if (z >= end) return z - (end - begin);
      return begin; //zapped
    };
    var op2 = (function () {
      var begin = zap(data2.begin, data2.end, data1.begin);
      var end = zap(data2.begin, data2.end, data1.end);
      if (begin == end) return null;
      return op_delete(begin, end);
    })();
    var op1 = (function () {
      var begin = zap(data1.begin, data1.end, data2.begin);
      var end = zap(data1.begin, data1.end, data2.end);
      if (begin == end) return null;
      return op_delete(begin, end);
    })();
    callback(op1, op2, false);
  });
  xform('insert', 'move', function (data1, data2, callback) {
    var inflate = function (pos, len, p, local) {
      if (p < pos) return p;
      if (p > pos) return p + len;
      if (local) return p;
      else return p + len;
    };
    var move = function (begin, end, target, p) {
      if (p <= begin) return p;
      if (p >= target) return p;
      if (p > begin && p <= end) return p + target - end;
      if (p > end && p < target) return p - (end - begin);
    };
    var pos = data1.pos, len = data1.text.length;
    var op1 = op_move(
      inflate(pos, len, data2.begin, false),
      inflate(pos, len, data2.end, false),
      inflate(pos, len, data2.target, true)
    );
    var op2 = op_insert(
      move(data2.begin, data2.end, data2.target, pos),
      data1.text
    );
    var conflict = false;
    if (pos == data1.begin || pos == data2.end || pos == data2.target) {
      conflict = true;
    }
    callback(op1, op2, conflict);
  });

  xform('delete', 'move', function (data1, data2, callback) {
    var b1 = data1.begin, e1 = data1.end, b2 = data2.begin, e2 = data2.end, t2 = data2.target;
    if (t2 < b2) {
      var temp = b2;
      b2 = t2;
      e2 = b2;
      t2 = temp;
    }
    var order = function (a, b, c, d, e) {
      return a <= b && b <= c && c <= d && d <= e;
    };
    var refine = function (op2) {
      if(op2.length == 2){
        var off = op2[0].data.end - op2[0].data.begin;
        op2[1] = op_delete(op2[1].data.begin - off, op2[1].data.end - off);
      }
      else if (op2.length == 1) op2 = op2[0];
      else if (op2.length == 0) op2 = null;
      return op2;
    };
    if (e1 <= b2) {
      var del = e1 - b1;
      callback(op_move(b2 - del, e2 - del, t2 - del), op_delete(b1, e1), false);
    } else if (b1 >= t2) {
      callback(op_move(b2, e2, t2), op_delete(b1, e1), false);
    } else if (b1 >= b2 && e1 <= e2) {
      var off = t2 - e2;
      var del = e1 - b1;
      callback(op_move(b2, e2 - del, t2 - del), op_delete(b1 + off, e1 + off), false);
    } else if (b1 >= e2 && e1 <= t2) {
      var off = b2 - e2;
      var del = e1 - b1;
      callback(op_move(b2, e2, t2 - del), op_delete(b1 + off, e1 + off), false);
    } else if (b2 >= b1 && t2 <= e1) {
      callback(null, op_delete(b1, e1), false);
    }
    //let's hardcode conflicts.
    else if (order(b1, b2, e1, e2, t2)) {
      var op1 = (e1 != e2 && e2 != t2) ? op_move(b1, e2 - (e1 - b1), t2 - (e1 - b1)) : null;
      var op2 = [];
      if (b1 != b2) op2.push(op_delete(b1, b2));
      if (e1 != b2) op2.push(op_delete(b2 + (t2 - e2), e1 + (t2 - e2)));
      op2 = refine(op2);
      callback(op1, op2, true);
    } else if (order(b2, b1, e2, e1, t2)) {
      var op1 = (b2 != b1 && e1 != t2) ? op_move(b2, b1, b1 + (t2 - e1)) : null;
      var op2 = [];
      if (e2 != e1) op2.push(op_delete(b2, b2 + (e1 - e2)));
      if (b1 != e2) op2.push(op_delete(t2 - (e2 - b1), t2));
      op2 = refine(op2);
      callback(op1, op2, true);
    } else if (order(b2, e2, b1, t2, e1)) {
      var op1 = (b2 != e2 && e2 != b1) ? op_move(b2, e2, b1) : null;
      var op2 = [];
      if (b1 != t2) op2.push(op_delete(b2 + (b1 - e2), b2 + (b1 - e2) + (t2 - b1)));
      if (t2 != e1) op2.push(op_delete(t2, e1));
      op2 = refine(op2);
      callback(op1, op2, true);
    } else if (order(b1, b2, e2, e1, t2)) {
      var op2 = [];
      if (b2 != b1 || e2 != e1) op2.push(op_delete(b1, b2 + (e1 - e2)));
      if (e2 != b2) op2.push(op_delete(t2 - (e2 - b2), t2));
      op2 = refine(op2);
      callback(null, op2, true);
    } else if (order(b2, b1, e2, t2, e1)) {
      var op2 = [];
      if (t2 != e2) op2.push(op_delete(b2, b2 + (t2 - e2)));
      if (e2 != b1 || e1 != t2) op2.push(op_delete(t2 - (e2 - b1), e1));
      op2 = refine(op2);
      callback(null, op2, true);
    }
    else
      throw new Error("Don't know what happened here.");
  });

  xform('move', 'move', function (data1, data2, callback) {
    var b1 = data1.begin, e1 = data1.end, t1 = data1.target,
      b2 = data2.begin, e2 = data2.end, t2 = data2.target;
    if (t1 < b1) {
      var temp = b1;
      b1 = t1;
      e1 = b1;
      t1 = temp;
    }
    if (t2 < b2) {
      var temp = b2;
      b2 = t2;
      e2 = b2;
      t2 = temp;
    }
    if (b2 >= b1 && t2 <= e1) {
      var off = t1 - e1;
      callback(op_move(b2 + off, e2 + off, t2 + off), op_move(b1, e1, t1), false);
    } else if (b2 >= e1 && t2 <= t1) {
      var off = b1 - e1;
      callback(op_move(b2 + off, e2 + off, t2 + off), op_move(b1, e1, t1), false);
    } else if (b1 >= b2 && t1 <= e2) {
      var off = t2 - e2;
      callback(op_move(b2, e2, t2), op_move(b1 + off, e1 + off, t1 + off), false);
    } else if (b1 >= e2 && t1 <= t2) {
      var off = b2 - e2;
      callback(op_move(b2, e2, t2), op_move(b1 + off, e1 + off, t1 + off), false);
    } else {
      //Messy moves. There isn't a good way to solve it: just rollback both of them.
      callback(op_move(b1, b1 + t1 - e1, t1), op_move(b2, b2 + t2 - e2, t2), true);
    }

  });


})();

var verifyEquals = function(a1, a2, b1, b2) {
  var toArray = function(x) {
    if(x instanceof Array) return x;
    if(x!=null) return [x];
    return [];
  };
  var seqA = toArray(a1).concat(toArray(a2));
  var seqB = toArray(b1).concat(toArray(b2));
  var doc1 = new Document(), doc2 = new Document();
  doc1.text = doc2.text = "abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()_+";
  doc1.apply(seqA);
  doc2.apply(seqB);
  if(doc1.text != doc2.text) {
    console.log("WARNING: verifyEquals fails.");
    console.log("a1: "+JSON.stringify(a1));
    console.log("a2: "+JSON.stringify(a2));
    console.log("b1: "+JSON.stringify(b1));
    console.log("b2: "+JSON.stringify(b2));
  }

};

var individualTransform = function (A, B) {
  var ops = pair(A.op, B.op);
  var op1, op2, conflict;
  var callback = function (_op1, _op2, _conflict) {
    op1 = _op1;
    op2 = _op2;
    conflict = _conflict;
  };
  lookup_table[ops](A.data, B.data, callback);
  verifyEquals(A, op1, B, op2);
  return {op1:op1, op2:op2, conflict:conflict};
};

var transform = function (seqA, seqB) {
  if (seqA.length == 0) return {op1:[], op2:seqA, conflict:false};
  if (seqB.length == 0) return {op1:seqB, op2:[], conflict:false};
  var conflict = false;
  var aPrime = [];
  var curB = seqB;
  var nextB = [];
  for (var i = 0; i < seqA.length; i++) {
    var currentA = seqA[i];
    for (var j = 0; j < curB.length; j++) {
      var res = individualTransform(currentA, curB[j]);
      if (res.conflict) conflict = true;

      if (res.op1 instanceof Array) {
        res.op1.forEach(function (ele) {
          nextB.push(ele);
        });
      } else if (res.op1 != null) nextB.push(res.op1);

      if (res.op2 instanceof Array) {
        var res2 = transform(res.op2, curB.slice(j + 1));
        if (res2.conflict) conflict = true;
        res2.op2.forEach(function (ele) {
          aPrime.push(ele);
        });
        res2.op1.forEach(function (ele) {
          nextB.push(ele);
        });
        currentA = null;
        break;
      } else {
        currentA = res.op2;
        if (currentA == null) {
          nextB = nextB.concat(curB.slice(j + 1));
          break;
        }
      }
    }
    if (currentA != null) aPrime.push(currentA);
    curB = nextB;
    nextB = [];
  }
  return {op1:curB, op2:aPrime, conflict:conflict};
};

/*(function test() {
  var doc1 = new Document(), doc2 = new Document();
  doc1.text = doc2.text = "abcdefghijklmnopqrstuvwxyz1234567890";
  var seqA = [op_insert(2, 'lol'), op_move(10, 13, 19), op_insert(7, "hahaha"), op_delete(3, 6), op_move(1, 3, 5)];
  var seqB = [op_insert(3, 'ha'), op_delete(14, 19), op_insert(13, "efwe"), op_delete(2, 3), op_move(1, 4, 8)];
  var res = transform(seqA, seqB);
  console.log(JSON.stringify(res));
  doc1.apply(seqA);
  doc2.apply(seqB);
  console.log("Document 1 (before merge):\n" + doc1.text);
  console.log("Document 2 (before merge):\n" + doc2.text);
  doc1.apply(res.op1);
  doc2.apply(res.op2);
  console.log("Document 1 (after merge):\n" + doc1.text);
  console.log("Document 2 (after merge):\n" + doc2.text);
})();*/

module.exports = exports = {
  transform:transform,
  op_insert: op_insert,
  op_delete: op_delete,
  op_move: op_move
};
