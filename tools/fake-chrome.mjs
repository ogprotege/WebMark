export function createFakeChrome(initial = {}, hooks = {}) {
  const data = { ...initial };
  const listeners = [];
  let writeCount = 0;

  const emit = (changes, areaName = "local") => {
    listeners.forEach((listener) => listener(changes, areaName));
  };

  const local = {
    async get(keys) {
      if (keys == null) return { ...data };
      if (typeof keys === "string") {
        return keys in data ? { [keys]: data[keys] } : {};
      }
      if (Array.isArray(keys)) {
        return Object.fromEntries(
          keys.filter((key) => key in data).map((key) => [key, data[key]])
        );
      }
      const out = {};
      for (const [key, fallback] of Object.entries(keys)) {
        out[key] = key in data ? data[key] : fallback;
      }
      return out;
    },

    async set(values) {
      const snapshot = structuredClone(values);
      writeCount++;
      if (hooks.beforeSet) {
        await hooks.beforeSet({ data, snapshot, writeCount });
      }
      Object.assign(data, snapshot);
      if (hooks.afterSet) {
        await hooks.afterSet({ data, snapshot, writeCount });
      }
    },

    async remove(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      if (hooks.beforeRemove) await hooks.beforeRemove({ data, keys: list });
      list.forEach((key) => delete data[key]);
      if (hooks.afterRemove) await hooks.afterRemove({ data, keys: list });
    },
  };

  return {
    runtime: {
      onMessage: { addListener() {} },
      async sendMessage() { return { ok: true }; },
    },
    storage: {
      local,
      onChanged: {
        addListener(listener) {
          listeners.push(listener);
        },
      },
    },
    _dump: () => data,
    _emit: emit,
    _put(key, value) {
      data[key] = value;
    },
    _delete(key) {
      delete data[key];
    },
  };
}
