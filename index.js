var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var path = require('path');
var Redis = require('ioredis');

var pubsub = new Redis();
var redis = new Redis();
server.listen(8080);

app.use(express.static(path.join(__dirname, 'static')));

app.get('/hashtags/:hashtag', function (req, res, next) {
  var hashtag = req.params.hashtag;
  redis.lrange('hashtags:list:' + hashtag, 0, 100).then(function (result) {
    res.send(result);
  });
});

io.on('connection', function (socket) {
  // Send cache to client
  redis.lrange('features', 0, 50).then(function (results) {
    results.forEach(function (result) {
      socket.emit('initfeatures', result);
    });
  });

  emitHashtags();
});

function emitHashtags () {
  redis.keys('hashtags:score:6:*')
  .then(function (keys) {
    var list = [];
    redis.mget(keys).then(function (values) {
      keys.forEach(function (key, index) {
        list.push([key, parseInt(values[index], 10)]);
      });
      list.sort(function (a, b) {
        if (a[1] > b[1]) return -1;
        if (a[1] < b[1]) return 1;
        return 0;
      });
      io.emit('hashtags', list.slice(0, 10));
    });
  });
}

pubsub.subscribe('featuresch', function (err) {
  if (err) console.log(err);
});

pubsub.on('message', function (channel, data) {
  console.log('message:', data);
  if (data) io.emit('log', data);
});

setInterval(function () {
  emitHashtags();
}, 60000);

