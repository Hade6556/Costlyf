(function () {
  'use strict';

  function getReturnUrl() {
    var params = new URLSearchParams(window.location.search);
    return params.get('from') || '/home';
  }

  document.getElementById('help-back').href = getReturnUrl();
})();
