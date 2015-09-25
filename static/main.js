/*global L, $, io, omnivore, tinysort */

var root = 'http://localhost:8080';
var map = L.map('map').setView([0, 0], 2);
L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18
}).addTo(map);

var socket = io.connect(root);

var nextTimeline = [];
var currentTimeline = [];
socket.on('timeline', function (timeline) {
  nextTimeline = timeline;
  console.log(nextTimeline.length);
});

function resetUI () {
  console.log('resetUI');
  $('#leaderboard').empty();
}

setInterval(function () {
  if (currentTimeline.length === 0) {
    currentTimeline = nextTimeline.slice(0);
    resetUI();
  } else {
    render(currentTimeline.pop());
  }
}, 50);

var similar = {};
function render (element) {
  var logroll = $('#logroll');
  var leaderboard = $('#leaderboard');
  var hashtag = element[2];
  var feature = (element[0].startsWith('P')) ? 'building' : 'way';
  var time = element[1];

  if (!similar.count) {
    similar.feature = feature;
    similar.hashtag = hashtag;
    similar.time = time;
    similar.count = 1;
  } else {
    if (hashtag === similar.hashtag &&
        time === similar.time &&
          feature === similar.feature) {
      similar.count += 1;
    } else {
      logroll.prepend('<div class="logroll-item">' +
                      similar.count + ' ' + similar.feature + '(s) -' +
                      similar.hashtag + '</div>');
      var el;
      if ($('[tag=' + similar.hashtag + ']').length === 0) {
        el = $('<li>' + similar.hashtag + '</li>');
        $(el).attr('tag', similar.hashtag);
        $(el).attr('count', similar.count);
        leaderboard.append(el);
      } else {
        el = $('[tag=' + similar.hashtag + ']');
        var count = Number($(el).attr('count'));
        $(el).attr('count', count + similar.count);
      }
      sort();
      similar = {};
    }
  }

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
  tinysort('ul#leaderboard>li').forEach(function (elm, i) {
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
