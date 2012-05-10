var EventEmitter= require('events').EventEmitter;
var Document = function () {
  var instance = this;
  this.text = '';
  this.apply = function (edit_seq) {
    edit_seq.forEach(function (edit) {
      var op = edit.op;
      var data = edit.data;
      if (op == 'insert') {
        instance.text = instance.text.substr(0, data.pos) + data.text + instance.text.substr(data.pos);
      } else if (op == 'delete') {
        instance.text = instance.text.substr(0, data.begin) + instance.text.substr(data.end);
      } else if (op == 'move') {
        var b = data.begin, e = data.end, t = data.target;
        if (t < b) {
          var temp = b;
          b = t;
          e = b;
          t = temp;
        }
        instance.text = instance.text.substr(0, b) + instance.text.substr(e, t - e) + instance.text.substr(b, e - b) + instance.text.substr(t);
      }
    });
    this.emit('changed');
  }
};
Document.prototype = new EventEmitter();
module.exports = exports = Document;