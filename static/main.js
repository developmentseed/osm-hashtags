var root = 'http://104.197.85.117:8080';
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
      $("[data=" + hashtag + "]")
        .css("color", "orange")
        .fadeTo('slow', 0.5)
        .fadeTo('slow', 1.0)
        .hover(function(){$(this).css("color","#D04527");})
        .mouseout(function(){$(this).css("color", "orange");});
    });
  }

  if (typeof toAdd !== undefined || toAdd[0] === '{') {
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

socket.on('buildings', function (data) {
  console.log('buildings', data);
});

socket.on('highways', function (data) {
  console.log('highways', data);
});

function handleHashtags (data) {
  var leaderboard = $('#hashtag-leaderboard');
  leaderboard.empty();
  data.forEach(function (hashtagTuple, index) {
    var hashtagData = hashtagTuple[0].slice(15);
    leaderboard.append('<div class="hashtag-item" data="'+ hashtagData +'">' +
                       (index + 1)  + '. ' + hashtagData + '</div>');
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

$('#hashtag-switch').on('click', function(){
  $("#log-switch").css("background", "rgba(230, 230, 230, 0.8)");
  $(this).css("background", "rgba(255, 255, 255, 0.9");
  leaderbox.hide()
  hashtagbox.show()
});

$('#log-switch').on('click', function(){
  $("#hashtag-switch").css("background", "rgba(230, 230, 230, 0.8)");
  $(this).css("background", "rgba(255, 255, 255, 0.9");  
 leaderbox.show()
 hashtagbox.hide()
});