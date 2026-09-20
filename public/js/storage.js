/* ==========================================================================
   storage.js
   Thin, defensive wrapper around localStorage.
   - Never throws (private browsing / disabled storage / quota errors).
   - Stores only the in-progress registration ("draft"). Submitted teams are
     saved by the server in the SQLite database, never in the browser.
   ========================================================================== */
(function () {
  "use strict";

  const SA = (window.SA = window.SA || {});
  const settings = SA.config.storage;

  function read(key) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function write(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      /* nothing to do */
    }
  }

  SA.storage = {
    /** True when localStorage can actually be written to. */
    isAvailable: function () {
      try {
        const probe = "__saj26_probe__";
        window.localStorage.setItem(probe, "1");
        window.localStorage.removeItem(probe);
        return true;
      } catch (error) {
        return false;
      }
    },

    /** Returns the saved draft, or null if none / incompatible version. */
    loadDraft: function () {
      const draft = read(settings.draftKey);
      if (!draft || draft.version !== settings.version || !draft.data) return null;
      return draft;
    },

    /** Saves the draft ({ step, maxStep, data }). Returns true on success. */
    saveDraft: function (draft) {
      return write(
        settings.draftKey,
        Object.assign({}, draft, { version: settings.version, savedAt: new Date().toISOString() })
      );
    },

    clearDraft: function () {
      remove(settings.draftKey);
    },
  };
})();
