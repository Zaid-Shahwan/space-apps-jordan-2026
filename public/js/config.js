/* ==========================================================================
   config.js
   Central configuration. Everything an organizer might need to change
   (dates, team limits, contact details, API endpoint) lives here.
   ========================================================================== */
(function (root) {
  "use strict";

  // Runs in the browser (window.SA) and in Node (server/registration.js requires this file).
  const SA = (root.SA = root.SA || {});

  SA.config = {
    siteName: "NASA Space Apps Challenge",
    editionLabel: "IRBID 2026",

    /* Event window. Jordan is UTC+3 all year. Adjust once the start time is announced. */
    eventStart: "2026-11-13T00:00:00+03:00",
    eventEnd: "2026-11-15T00:00:00+03:00",

    /* One team lead submits a team of one to six (the lead counts as a member). */
    team: { min: 1, max: 6 },

    /* Registration submission. The Express server (server/server.js) serves this
       site and the API from the same origin, so a relative URL is used. */
    api: {
      endpoint: "/api/register",
      timeoutMs: 15000,
    },

    /* localStorage key for the in-progress form draft (registered teams live in the
       SQLite database, not in the browser). Bump `version` if the draft shape changes. */
    storage: {
      draftKey: "saj26.draft",
      version: 2,
    },

    contact: {
      email: "contact@menaorg.com",
      phone: "+962 790607949",
      phoneHref: "tel:+962790607949",
    },

    /* Links to the official platform and to the organizer's legal pages. */
    links: {
      global: "https://www.spaceappschallenge.org/",
      participantTerms: "https://www.spaceappschallenge.org/legal/",
      resources: "https://www.spaceappschallenge.org/resources/",
      challenges2026: "https://www.spaceappschallenge.org/2026/",
      privacy: "https://www.nasaspaceappschallenge-amman-aqaba.com/privacy/",
      terms: "https://www.nasaspaceappschallenge-amman-aqaba.com/terms/",
    },

    /* The six registration steps, in order. */
    steps: [
      { id: "team", short: "Team", title: "Team information" },
      { id: "leader", short: "Leader", title: "Team leader" },
      { id: "members", short: "Members", title: "Team members" },
      { id: "location", short: "Location", title: "Participation and location" },
      { id: "details", short: "Details", title: "Additional information" },
      { id: "review", short: "Review", title: "Review and submit" },
    ],
  };

  if (typeof module !== "undefined" && module.exports) module.exports = SA.config;
})(typeof window !== "undefined" ? window : globalThis);
