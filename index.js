var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var path = require('path');
var Redis = require('ioredis');
var Promise = require('bluebird');
var parse = require('wellknown');
var turf = require('turf');

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
  redis.lrange('features', 0, 100).then(function (results) {
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
    redis.mget(keys)
    .then(function (values) {
      keys.forEach(function (key, index) {
        list.push([key, parseInt(values[index], 10)]);
      });
      list.sort(function (a, b) {
        if (a[1] > b[1]) return -1;
        if (a[1] < b[1]) return 1;
        return 0;
      });

      io.emit('hashtags', list.slice(0, 10));
      return keys;
    })
    .then(function (keys) {
      // For each key, get the last 50 values for that hashtag
      var getFeatures = keys.map(function (key) {
        var hashtag = key.slice(17);
        return redis.lrange('hashtags:list:' + hashtag, 0, 100);
      });
      return Promise.all(getFeatures)
      .then(function (featuresOfHashtags) {
        // For each hashtag, union the features to get bounds
        var bounds = featuresOfHashtags.map(function (featureList) {
          var geojsonList = featureList.map(parse).map(function (geojson) {
            return {'type': 'Feature', 'geometry': geojson};
          });
          var fc = turf.featurecollection(geojsonList);
          return turf.extent(fc);
        });
        io.emit('bounds', bounds);
      });
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

// Update the leaderboard
setInterval(emitHashtags, 60000);

