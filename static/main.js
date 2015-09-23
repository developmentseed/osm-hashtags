/*global L, $, io, omnivore, jQuery */
jQuery.fn.highlight = function () {
  $(this).each(function () {
    var el = $(this);
    $('<div/>')
    .width(el.outerWidth())
    .height(el.outerHeight())
    .css({
      'position': 'absolute',
      'left': el.offset().left,
      'top': el.offset().top,
      'background-color': '#ffff99',
      'opacity': '.7',
      'z-index': '9999999'
    }).appendTo('body').fadeOut(2000).queue(function () { $(this).remove(); });
  });
};

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

setInterval(function () {
  var toAdd = logRoll.pop();
  var logroll = $('#logroll');

  var hashtags = [];
  try {
    hashtags = JSON.parse(toAdd).hashtags;
  } catch(e) {
    console.log(toAdd);
  }

  if (hashtags.length) {
    hashtags.forEach(function (hashtag) {
      $('[data=' + hashtag + ']').highlight();
    });
  }

  if (typeof toAdd !== undefined) {
    logroll.prepend('<div class="logitem">' + toAdd + '</div>');
  }
  if (logroll.children().length > 100) {
    $('#logroll div:last-child').remove();
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
  var hashtag = $(this).text().slice(3);
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
