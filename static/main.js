/*global L, $, io, omnivore */

var root = 'http://hashtags.developmentseed.org';
var map = L.map('map').setView([0, 0], 2);
L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18
}).addTo(map);

var socket = io.connect(root);

var logRoll = [];

socket.on('initfeatures', handleInitialFeatures);
function handleInitialFeatures (data) {
  logRoll.push(data);
}

var activeBoundsGroup = new L.FeatureGroup().addTo(map);
socket.on('bounds', function (boundsList) {
  activeBoundsGroup.clearLayers();
  boundsList.map(function (extent) {
    return [ [extent[3], extent[0]], [extent[1], extent[2]]];
  }).forEach(function (bounds) {
    activeBoundsGroup.addLayer(L.rectangle(bounds, {color: '#ff7800', weight: 1}));
  });
});

setInterval(function () {
  if (!logRoll.length) {
    return;
  }
  var toAdd = logRoll.pop();
  var logroll = $('#logroll');

  var hashtags = [];
  try {
    hashtags = JSON.parse(toAdd).hashtags;
    if (hashtags.length) {
      hashtags.forEach(function (hashtag) {
        $('[data=' + hashtag + ']')
          .css('color', 'orange')
          .fadeTo('slow', 0.5)
          .fadeTo('slow', 1.0)
          .hover(function () { $(this).css('color', '#D04527'); })
          .mouseout(function () {$(this).css('color', 'orange'); });
      });
    }

    if (typeof toAdd !== undefined) {
      logroll.prepend('<div class="logitem">' + toAdd + '</div>');
    }

    if (logroll.children().length > 100) {
      $('#logroll div:last-child').remove();
    }
  } catch(e) {
    console.log(toAdd);
  }

}, 1000);

socket.on('log', function (data) {
  logRoll.push(data);
});

socket.on('hashtags', handleHashtags);

function handleHashtags (data) {
  var leaderboard = $('#hashtag-leaderboard');
  leaderboard.empty();
  data.forEach(function (hashtagTuple, index) {
    var hashtagData = hashtagTuple[0].slice(17);
    leaderboard.append('<div class="hashtag-item" data="' + hashtagData + '">' +
                       (index + 1) + '. ' + hashtagData + '</div>');
  });
}

$('#hashtag-leaderboard').on('click', '.hashtag-item', function (e) {
  var hashtag = $(this).attr('data');
  getHashtagData(hashtag).then(displayHashtagData);
});

function getHashtagData (hashtag) {
  return $.get(root + '/hashtags/' + hashtag);
}
var activeLayerGroup = new L.FeatureGroup().addTo(map);

function displayHashtagData (data) {
  activeLayerGroup.clearLayers();
  data.forEach(function (item) {
    activeLayerGroup.addLayer(omnivore.wkt.parse(item));
  });
  map.fitBounds(activeLayerGroup.getBounds());
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
