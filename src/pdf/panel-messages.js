// Routes toolbar and shortcut messages once the asynchronously-created PDF
// notes panel is ready, so early user actions are not dropped.
(function () {
  const W = (globalThis.WebMark = globalThis.WebMark || {});

  class PanelMessageRouter {
    constructor(panelReady) {
      this.panelReady = Promise.resolve(panelReady);
    }

    dispatch(message) {
      if (!message || (message.type !== "toggle" && message.type !== "capture")) {
        return Promise.resolve(false);
      }
      return this.panelReady
        .then((panel) => {
          if (!panel) return false;
          if (message.type === "toggle") {
            panel.toggle();
          } else {
            if (!panel.isOpen) panel.open();
            panel.addSelection();
          }
          return true;
        })
        .catch(() => false);
    }
  }

  W.PanelMessageRouter = PanelMessageRouter;
})();
