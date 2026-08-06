(function () {
  var favicon = document.getElementById("favicon");
  if (!favicon) return;

  var icons = ["/favicon-static.svg", "/favicon-animated.svg"];
  var currentIcon = 0;

  window.setInterval(function () {
    currentIcon = (currentIcon + 1) % icons.length;
    favicon.href = icons[currentIcon];
  }, 3000);
})();