/*global L, $, io, omnivore */

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
});

function resetUI () {
  console.log('resetUI');
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
      logroll.prepend('<div class="hashtag-item" data="' + similar.hashtag + '">' +
                      similar.count + ' ' + similar.feature + '(s) -' +
                      similar.hashtag + '</div>');
      similar = {};
    }
  }

  if (logroll.children().length > 100) {
    $('#logroll div:last-child').remove();
  }
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
