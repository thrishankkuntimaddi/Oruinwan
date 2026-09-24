'use strict';

// Offline fallback page logic. Kept in a separate file so the page CSP can
// forbid inline scripts (script-src 'self').
(function () {
  var RETRY_INTERVAL_S = 15;
  var button = document.getElementById('retry');
  var status = document.getElementById('status');
  var remaining = RETRY_INTERVAL_S;

  function retry() {
    button.disabled = true;
    status.textContent = 'Reconnecting…';
    if (window.electronAPI && typeof window.electronAPI.retryConnect === 'function') {
      window.electronAPI.retryConnect();
    } else {
      window.location.reload();
    }
    // If the main process could not connect it reloads this page; re-enable
    // the button in case it did not.
    setTimeout(function () {
      button.disabled = false;
      remaining = RETRY_INTERVAL_S;
    }, 5000);
  }

  button.addEventListener('click', retry);
  window.addEventListener('online', retry);

  setInterval(function () {
    if (button.disabled) return;
    remaining -= 1;
    if (remaining <= 0) {
      retry();
      return;
    }
    status.textContent = 'Retrying in ' + remaining + 's';
  }, 1000);

  status.textContent = 'Retrying in ' + remaining + 's';
})();
