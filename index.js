var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var path = require('path');
var Redis = require('ioredis');
var Promise = require('bluebird');

var pubsub = new Redis();
var redis = new Redis();
server.listen(8080);

app.use(express.static(path.join(__dirname, 'static')));

app.get('/hashtags/:hashtag', function (req, res, next) {
  var hashtag = req.params.hashtag;
  redis.lrange('hashtags:list:' + decodeURIComponent(hashtag), 0, 100).then(function (result) {
    res.send(result);
  });
});

app.get('/timeline', function (req, res) {
  redis.get('timeline').then(function (result) {
    res.send(result);
  });
});

io.on('connection', function (socket) {
  emitHashtags();
});

function preprocess (currentTimeline) {
  var similar = {};
  var retTimeline = [];
  currentTimeline.forEach(function (element) {
    var hashtag = element[2];
    var feature = (element[0].startsWith('P')) ? 'building' : 'way';
    var time = element[1];
    if (!similar.count) {
      similar.feature = feature;
      similar.hashtag = hashtag;
      similar.time = time;
      similar.last = element[0];
      similar.count = 1;
    } else {
      if (hashtag === similar.hashtag &&
          time === similar.time &&
            feature === similar.feature) {
        similar.count += 1;
      } else {
        retTimeline.push(similar);
        similar = {};
      }
    }
  });
  if (similar.count) {
    retTimeline.push(similar);
  }
  return retTimeline;
}

function emitHashtags () {
  redis.keys('hashtags:score:6:*')
  .then(function (keys) {
    if (!keys.length) return;
    var list = [];
    redis.mget(keys)
    .then(function (values) {
      keys.forEach(function (key, index) {
        list.push([key, parseInt(values[index], 10)]);
      });
      return list;
    })
    .then(function (list) {
      // For each key, get the last 50 values for that hashtag
      var getFeatures = list.map(function (tuple) {
        var hashtag = tuple[0].slice(17);
        return redis.lrange('hashtags:list:' + hashtag, 0, tuple[1]);
      });
      return Promise.all(getFeatures)
      .then(function (featuresOfHashtags) {
        var timeline = featuresOfHashtags
        .map(function (featureList, index) {
          return featureList.map(function (feature) {
            return feature + '|' + list[index][0].slice(17);
          }).map(function (feature) {
            return feature.split('|');
          });
        })
        .reduce(function (a, b) { return a.concat(b); });

        console.log('oldlength', timeline.length);
        timeline = preprocess(timeline);
        console.log('newlength', timeline.length);

        timeline = timeline.sort(function (a, b) {
          if (Date.parse(a.time) > Date.parse(b.time)) return -1;
          if (Date.parse(a.time) < Date.parse(b.time)) return 1;
          return 0;
        });

        redis.set('timeline', JSON.stringify(timeline));

        io.emit('timeline', timeline);
      });
    });
  });
}

pubsub.subscribe('featuresch', function (err) {
  if (err) console.log(err);
});

pubsub.on('message', function (channel, data) {
  if (data) io.emit('log', data);
});

// Update the leaderboard
setInterval(emitHashtags, 120000);

