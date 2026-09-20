/* ==========================================================================
   main.js
   Site-wide UI behaviour that is not specific to the registration form:
     - Navigation (mobile menu, scroll state)
     - Launch countdown
     - Reveal-on-scroll
     - Motion preferences for the SVG orbit
   Form logic lives in storage.js, validation.js, form.js and submission.js.
   ========================================================================== */
(function () {
  "use strict";

  const SA = (window.SA = window.SA || {});
  const cfg = SA.config;

  const prefersReducedMotion = function () {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  };

  /* ---------------------------------------------------------------------
     Navigation
     --------------------------------------------------------------------- */
  const Nav = {
    init: function () {
      this.header = document.querySelector(".site-header");
      this.toggle = document.querySelector(".nav-toggle");
      this.panel = document.getElementById("site-nav");
      if (!this.header) return;

      this.updateScrollState();
      window.addEventListener("scroll", this.updateScrollState.bind(this), { passive: true });

      if (!this.toggle || !this.panel) return;

      this.toggle.addEventListener("click", this.handleToggle.bind(this));

      // Close after choosing a link (event delegation on the panel).
      this.panel.addEventListener("click", (event) => {
        if (event.target.closest("a")) this.close();
      });

      // Close when clicking anywhere outside the header.
      document.addEventListener("click", (event) => {
        if (this.isOpen() && !this.header.contains(event.target)) this.close();
      });

      // Close on Escape and hand focus back to the toggle button.
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && this.isOpen()) {
          this.close();
          this.toggle.focus();
        }
      });

      // If the viewport grows to the desktop layout, reset the mobile state.
      const desktop = window.matchMedia("(min-width: 900px)");
      const onChange = (event) => {
        if (event.matches) this.close();
      };
      if (desktop.addEventListener) desktop.addEventListener("change", onChange);
    },

    isOpen: function () {
      return this.toggle.getAttribute("aria-expanded") === "true";
    },

    handleToggle: function () {
      if (this.isOpen()) this.close();
      else this.open();
    },

    open: function () {
      this.toggle.setAttribute("aria-expanded", "true");
      this.toggle.setAttribute("aria-label", "Close menu");
      this.header.classList.add("is-menu-open");
    },

    close: function () {
      this.toggle.setAttribute("aria-expanded", "false");
      this.toggle.setAttribute("aria-label", "Open menu");
      this.header.classList.remove("is-menu-open");
    },

    updateScrollState: function () {
      this.header.classList.toggle("is-scrolled", window.scrollY > 8);
    },
  };

  /* ---------------------------------------------------------------------
     Countdown to the event start
     Markup: [data-countdown] containing [data-cd="days|hours|minutes"],
     an optional [data-cd-label] and an optional [data-cd-sr].
     --------------------------------------------------------------------- */
  const Countdown = {
    init: function () {
      this.roots = Array.prototype.slice.call(document.querySelectorAll("[data-countdown]"));
      if (!this.roots.length) return;
      this.start = new Date(cfg.eventStart).getTime();
      this.end = new Date(cfg.eventEnd).getTime();
      this.tick();
      window.setInterval(this.tick.bind(this), 30000);
    },

    tick: function () {
      const now = Date.now();
      let state = "before";
      let diff = this.start - now;
      if (now >= this.end) state = "after";
      else if (now >= this.start) state = "live";

      const days = Math.max(0, Math.floor(diff / 86400000));
      const hours = Math.max(0, Math.floor((diff % 86400000) / 3600000));
      const minutes = Math.max(0, Math.floor((diff % 3600000) / 60000));

      this.roots.forEach(function (root) {
        root.setAttribute("data-state", state);
        const set = function (key, value) {
          const el = root.querySelector('[data-cd="' + key + '"]');
          if (el) el.textContent = String(value).padStart(2, "0");
        };
        set("days", days);
        set("hours", hours);
        set("minutes", minutes);

        const label = root.querySelector("[data-cd-label]");
        const sr = root.querySelector("[data-cd-sr]");
        if (state === "before") {
          if (label) label.textContent = "Until the event begins on 13 November";
          if (sr) sr.textContent = days + " days, " + hours + " hours and " + minutes + " minutes until the event begins on 13 November 2026.";
        } else if (state === "live") {
          if (label) label.textContent = "The event is under way";
          if (sr) sr.textContent = "The event is under way.";
        } else {
          if (label) label.textContent = "The 2026 event has finished";
          if (sr) sr.textContent = "The 2026 event has finished.";
        }
      });
    },
  };

  /* ---------------------------------------------------------------------
     Reveal on scroll (CSS handles the animation; JS only toggles a class)
     --------------------------------------------------------------------- */
  const Reveal = {
    init: function () {
      const items = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
      if (!items.length) return;

      if (!("IntersectionObserver" in window) || prefersReducedMotion()) {
        items.forEach(function (el) {
          el.classList.add("is-visible");
        });
        return;
      }

      const observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          });
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
      );
      items.forEach(function (el) {
        observer.observe(el);
      });
    },
  };

  /* ---------------------------------------------------------------------
     Orbit illustration: pause the SMIL satellite motion for users who
     prefer reduced motion.
     --------------------------------------------------------------------- */
  const Orbit = {
    init: function () {
      if (!prefersReducedMotion()) return;
      document.querySelectorAll("svg.orbit").forEach(function (svg) {
        if (typeof svg.pauseAnimations === "function") svg.pauseAnimations();
      });
    },
  };

  Nav.init();
  Countdown.init();
  Reveal.init();
  Orbit.init();

  SA.ui = { prefersReducedMotion: prefersReducedMotion };
})();
