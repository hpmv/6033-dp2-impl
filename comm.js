var net = require('net');
var events = require('events');
var DDR_PORT = 48342;
var JsonLineProtocol = require('json-line-protocol').JsonLineProtocol;

var Communication = function (serverPort) {
  var instance = this;
  this._master = null;
  this._slaves = [];
  var new_slave = function (conn) {
    conn._comm_ready = false;
    conn.setEncoding('UTF-8');
    conn.on('close', function() {
      for(var i=0;i<instance._slaves;i++){
        if(instance._slaves[i]==conn) {
          instance._slaves.splice(i, 1);
          break;
        }
      }
      instance.emit('lost_slave', conn);
    });
    var protocol = new JsonLineProtocol();
    protocol.on('value', function(value) {
      instance.emit('data', conn, value);
    });
    conn.on('data', function(data) {
      protocol.feed(data);
    });
    instance._slaves.push(conn);
    instance.emit('new_slave', conn);
  };
  var master_connected = function (conn) {
    conn.setEncoding('UTF-8');
    var protocol = new JsonLineProtocol();
    protocol.on('value', function(value) {
      instance.emit('data', conn, value);
    });
    conn.on('data', function(data) {
      protocol.feed(data);
    });
    instance.emit('master_connected', conn);
  };

  this.ready_slave = function (conn) {
    conn._comm_ready = true;
  };
  this.ready_master = function () {
    this._master._comm_ready = true;
  };

  this.ready = function(conn) {
    conn._comm_ready = true;
  };

  this._server = net.createServer(function (conn) {
    new_slave(conn);
  });
  this.init = function () {
    this._server.listen(serverPort);
  };
  this.connect = function (target, port) {
    if (this._master != null) return false;
    var conn = this._master = new net.Socket();

    conn._comm_ready = false;
    conn.on('close', function () {
      instance._master = null;
      instance.emit('lost_master', conn);
    });
    conn.connect(port, target, function () {
      master_connected(conn);
    });
    return true;
  };
  this.send = function(conn, data) {
    conn.write(JSON.stringify(data));
    conn.write('\r\n');
  };
  this.slaves = function() {
    var list =[];
    this._slaves.forEach(function(slave) {
      if(slave._comm_ready)
        list.push(slave);
    });
    return list;
  };
  this.master = function() {
    if (this._master && this._master._comm_ready) {
      return this._master;
    }
    return null;
  };
  this.all_connections = function() {
    var list = this.slaves();
    var master = this.master();
    if(master) list.push(master);
    return list;
  };


};

Communication.prototype = new events.EventEmitter();


/*(function test(){
  var com1 = new Communication(1234);
  var com2 = new Communication(2345);
  var com3 = new Communication(3456);
  com1.init();
  //com2.init();
  //com3.init();
  [[com1, 1], [com2, 2], [com3, 3]].forEach(function(item) {
    var com = item[0], num = item[1];
    com.on('new_slave', function(conn) {
      console.log("#"+num+": new slave.");
      com.send(conn, {hello:"slave!"});
    });
    com.on('master_connected', function(conn) {
      console.log("#"+num+": master connected.");
      com.send(conn, {hello:"world!"});
    });
    com.on('data', function(conn, data) {
      console.log("#"+num+": receive data: "+JSON.stringify(data));
    });
  });
  com2.connect('127.0.0.1');
  com3.connect('127.0.0.1');

})();*/

module.exports = exports = Communication;