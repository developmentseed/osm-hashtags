/*global L, $, io, omnivore, tinysort */
var root = 'http://hashtags.developmentseed.org';
var southWest = L.latLng(-89, 179),
    northEast = L.latLng(89, -179),
    bounds = L.latLngBounds(southWest, northEast);

var mapboxTiles = L.tileLayer('https://api.mapbox.com/v4/devseed.24440516/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoiZGV2c2VlZCIsImEiOiJnUi1mbkVvIn0.018aLhX0Mb0tdtaT2QNe2Q', {
    maxZoom: 2,
    minZoom: 2,
    maxBounds: bounds,
    attribution: '<a href="http://www.mapbox.com/about/maps/" target="_blank">Terms &amp; Feedback</a>'
});


var map = L.map('map')
    .addLayer(mapboxTiles)
    .setView([13.025966, -50], 2);

// new L.Control.Zoom({ position: 'topright' }).addTo(map);
var socket = io.connect(root);

var nextTimeline = [];
var currentTimeline = [];
socket.on('timeline', function (timeline) {
  nextTimeline = timeline;
});

var renderGroup = new L.FeatureGroup().addTo(map);
function resetUI () {
  $('#leaderboard').empty();
  $('#logroll').empty();
  renderGroup.clearLayers();
  $('#progress-bar').css('width', '0%');
}

var paused = false;
var progressBarWidth = 0;
var currentProgress = 0;
setInterval(function () {
  if (currentTimeline.length === 0) {
    currentTimeline = preprocess(nextTimeline.slice(0));
    progressBarWidth = currentTimeline.length;
    currentProgress = 0;
    paused = true;
    setTimeout(function () {
      paused = false;
      resetUI();
    }, 3000);
  } else {
    if (!paused) {
      render(currentTimeline.pop());
    }
  }
}, 400);

var options = {
  lng: function (d) { return d[0]; },
  lat: function (d) { return d[1]; },
  duration: 1000
};
var pingLayer = L.pingLayer(options).addTo(map);
pingLayer.radiusScale().range([2, 18]);
pingLayer.opacityScale().range([1, 0]);

function preprocess (currentTimeline) {
  console.log(currentTimeline);
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

function render (element) {

  var logroll = $('#logroll');
  var leaderboard = $('#leaderboard');

  var timecode = new Date(Date.parse(element.time));
  var date = timecode.getUTCHours() + ':' + timecode.getUTCMinutes();

  logroll.prepend('<div class="logroll-item"><i>' +
                  date + '</i> - ' +
                  element.count + ' ' + element.feature + '(s) -' +
                  element.hashtag + '</div>');
  var center = omnivore.wkt.parse(element.last).getBounds().getCenter();
  pingLayer.ping([center.lng, center.lat], 'red');

  currentProgress += 1;
  $('#progress-bar').css('width', (100 * currentProgress / progressBarWidth) + '%');

  var el;
  if ($('[tag=' + element.hashtag + ']').length === 0) {
    el = $('<li>' + '#' + element.hashtag + '</li>');
    $(el).attr('tag', element.hashtag);
    $(el).attr('count', element.count);
    leaderboard.append(el);
  } else {
    el = $('[tag=' + element.hashtag + ']');
    var count = Number($(el).attr('count'));
    $(el).attr('count', count + element.count);
  }
  sort();

  if (logroll.children().length > 100) {
    $('#logroll div:last-child').remove();
  }
}

function sort () {
  var ul = document.getElementById('leaderboard');
  var lis = ul.querySelectorAll('li');
  var liHeight = lis[0].offsetHeight;

  ul.style.height = ul.offsetHeight + 'px';
  for (var i = 0, l = lis.length; i < l; i++) {
    var li = lis[i];
    li.style.position = 'absolute';
    li.style.top = i * liHeight + 'px';
  }
  tinysort('ul#leaderboard>li', {attr: 'count', order: 'desc'}).forEach(function (elm, i) {
    setTimeout((function (elm, i) {
      elm.style.top = i * liHeight + 'px';
    }).bind(null, elm, i), 40);
  });
}

var hashtagbox = $('#leaderboards');
var leaderbox = $('#logroll-box');

$('#hashtag-switch').on('click', function () {
  $('#log-switch').css('background', 'rgba(230, 230, 230, 0.8)');
  $(this).css('background', 'rgba(255, 255, 255, 0.9');
  leaderbox.hide();
  hashtagbox.show();
});

$('#log-switch').on('click', function () {
  $('#hashtag-switch').css('background', 'rgba(230, 230, 230, 0.8)');
  $(this).css('background', 'rgba(255, 255, 255, 0.9');
  leaderbox.show();
  hashtagbox.hide();
});
