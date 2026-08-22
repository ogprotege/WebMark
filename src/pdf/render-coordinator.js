// Deduplicates asynchronous PDF page renders and invalidates stale work after
// zooming or eviction. Kept separate so the concurrency contract is testable.
(function () {
  const W = (globalThis.WebMark = globalThis.WebMark || {});

  class RenderCoordinator {
    constructor() {
      this.entries = new Map();
    }

    run(key, task) {
      const active = this.entries.get(key);
      if (active) return active.promise;

      const token = {};
      const entry = { token, promise: null };
      const isCurrent = () => {
        const current = this.entries.get(key);
        return !!current && current.token === token;
      };

      entry.promise = Promise.resolve()
        .then(() => task(isCurrent))
        .finally(() => {
          if (isCurrent()) this.entries.delete(key);
        });
      this.entries.set(key, entry);
      return entry.promise;
    }

    invalidate(key) {
      this.entries.delete(key);
    }

    invalidateAll() {
      this.entries.clear();
    }
  }

  W.RenderCoordinator = RenderCoordinator;
})();
