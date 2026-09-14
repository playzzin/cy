(function () {
  // Capture before the application bundle loads, and keep the event through hot reloads.
  var state = window.__cyPwaInstallState;
  if (!state) {
    state = window.__cyPwaInstallState = {
      deferredPrompt: null,
      installed: false,
      captureSetup: false,
      listeners: new Set()
    };
  }
  if (state.captureSetup) return;
  state.captureSetup = true;

  function notify() {
    state.listeners.forEach(function (listener) { listener(); });
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    state.deferredPrompt = event;
    state.installed = false;
    notify();
  });

  window.addEventListener('appinstalled', function () {
    state.installed = true;
    state.deferredPrompt = null;
    notify();
  });
}());
