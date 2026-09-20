/* ==========================================================================
   admin.js
   Logic for admin.html:
     - sign in and sign out (the server keeps the session in an HTTP-only cookie)
     - load the registered teams and show every team with all its members
     - search by team name, member name, member email or team id

   This file only shows data. Who may see it is decided by the server: every
   /api/teams request is rejected with 401 unless the admin cookie is valid.
   ========================================================================== */
(function () {
  "use strict";

  const $ = function (id) {
    return document.getElementById(id);
  };

  const els = {
    lead: $("admin-lead"),
    loginSection: $("admin-login"),
    loginForm: $("login-form"),
    loginEmail: $("login-email"),
    loginPassword: $("login-password"),
    loginSubmit: $("login-submit"),
    loginAlert: $("login-alert"),
    dashboard: $("admin-dashboard"),
    dashboardAlert: $("dashboard-alert"),
    search: $("team-search"),
    refresh: $("btn-refresh"),
    logout: $("btn-logout"),
    count: $("result-count"),
    list: $("team-list"),
    stats: {
      teams: $("stat-teams"),
      participants: $("stat-participants"),
      inPerson: $("stat-inperson"),
      online: $("stat-online"),
    },
  };

  const LABELS = {
    participation: {
      "in-person": "In-Person: Madaba, Jordan",
      online: "Online: from anywhere in the world",
    },
    ageGroup: { adult: "18 or older", minor: "Under 18" },
    skills: {
      software: "Software development",
      "data-ai": "Data science and AI",
      hardware: "Hardware and electronics",
      design: "Design and UX",
      science: "Science and research",
      storytelling: "Storytelling and communication",
    },
    heardFrom: {
      social: "Social media",
      friend: "Friend or colleague",
      school: "School or university",
      returning: "Took part before",
      organizer: "MENA ORG",
      other: "Somewhere else",
    },
  };

  /* ---------------------------------------------------------------------
     Small helpers
     --------------------------------------------------------------------- */

  /** Tiny DOM builder. `text` uses textContent, so registration data is never parsed as HTML. */
  function el(tag, props) {
    const node = document.createElement(tag);
    Object.keys(props || {}).forEach(function (key) {
      if (key === "class") node.className = props[key];
      else if (key === "text") node.textContent = props[key];
      else node.setAttribute(key, props[key]);
    });
    for (let i = 2; i < arguments.length; i += 1) {
      const child = arguments[i];
      if (child == null || child === false) continue;
      node.append(child.nodeType ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  function formatId(id) {
    return "#" + String(id).padStart(3, "0");
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" });
    } catch (error) {
      return String(iso);
    }
  }

  /** Calls the API. Resolves { status, ok, data }; rejects with { network: true } if the server is unreachable. */
  function api(url, options) {
    const opts = Object.assign({ credentials: "same-origin", headers: { Accept: "application/json" } }, options || {});
    if (opts.body && typeof opts.body !== "string") {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(opts.body);
    }
    return fetch(url, opts).then(
      function (response) {
        return response
          .json()
          .catch(function () { return {}; })
          .then(function (data) { return { status: response.status, ok: response.ok, data: data }; });
      },
      function () {
        return Promise.reject({ network: true });
      }
    );
  }

  function showAlert(node, message) {
    node.textContent = message;
    node.hidden = false;
  }

  function hideAlert(node) {
    node.textContent = "";
    node.hidden = true;
  }

  /* ---------------------------------------------------------------------
     Views
     --------------------------------------------------------------------- */
  function showLogin(message) {
    // Nothing from a previous session may stay in the page.
    els.list.replaceChildren();
    els.count.textContent = "";
    els.search.value = "";
    els.loginPassword.value = "";
    hideAlert(els.dashboardAlert);

    els.dashboard.hidden = true;
    els.loginSection.hidden = false;
    els.lead.textContent = "Sign in to see the registered teams.";
    if (message) showAlert(els.loginAlert, message);
    else hideAlert(els.loginAlert);
  }

  function showDashboard() {
    els.loginSection.hidden = true;
    els.dashboard.hidden = false;
    els.lead.textContent = "Every team that has registered, with all of its members.";
    hideAlert(els.loginAlert);
    return loadTeams(els.search.value);
  }

  /* ---------------------------------------------------------------------
     Sign in / sign out
     --------------------------------------------------------------------- */
  function onLogin(event) {
    event.preventDefault();
    const email = els.loginEmail.value.trim();
    const password = els.loginPassword.value;
    if (!email || !password) {
      showAlert(els.loginAlert, "Enter your email and password.");
      return;
    }

    hideAlert(els.loginAlert);
    els.loginSubmit.disabled = true;
    api("/api/admin/login", { method: "POST", body: { email: email, password: password } })
      .then(function (result) {
        if (result.ok) {
          els.loginPassword.value = "";
          return showDashboard();
        }
        showAlert(els.loginAlert, result.data.message || "Could not sign in.");
        els.loginPassword.value = "";
        els.loginPassword.focus();
        return null;
      })
      .catch(function () {
        showAlert(els.loginAlert, "Could not reach the server. Make sure it is running (npm start).");
      })
      .then(function () {
        els.loginSubmit.disabled = false;
      });
  }

  function onLogout() {
    els.logout.disabled = true;
    api("/api/admin/logout", { method: "POST" })
      .catch(function () { /* the session ends with the cookie anyway */ })
      .then(function () {
        els.logout.disabled = false;
        showLogin();
        els.loginEmail.focus();
      });
  }

  /* ---------------------------------------------------------------------
     Loading and searching
     --------------------------------------------------------------------- */
  let requestNumber = 0;

  function loadTeams(query) {
    const mine = (requestNumber += 1); // ignore answers that arrive after a newer search
    hideAlert(els.dashboardAlert);
    els.list.setAttribute("aria-busy", "true");
    els.count.textContent = "Loading teams...";

    return api("/api/teams?q=" + encodeURIComponent(query || ""))
      .then(function (result) {
        if (mine !== requestNumber) return;
        if (result.status === 401) {
          showLogin("Your session has ended. Please sign in again.");
          return;
        }
        if (!result.ok) {
          els.count.textContent = "";
          showAlert(els.dashboardAlert, result.data.message || "Could not load the teams.");
          return;
        }
        render(result.data.teams, result.data.summary, query);
      })
      .catch(function () {
        if (mine !== requestNumber) return;
        els.count.textContent = "";
        showAlert(els.dashboardAlert, "Could not reach the server. Make sure it is running (npm start).");
      })
      .then(function () {
        if (mine === requestNumber) els.list.setAttribute("aria-busy", "false");
      });
  }

  let searchTimer = null;
  function onSearchInput() {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(function () {
      loadTeams(els.search.value);
    }, 250);
  }

  /* ---------------------------------------------------------------------
     Rendering
     --------------------------------------------------------------------- */
  function row(label, value) {
    return el("div", { class: "team-card__row" }, el("dt", { text: label }), el("dd", null, value));
  }

  function mailLink(email) {
    return el("a", { href: "mailto:" + encodeURI(email), text: email });
  }

  function renderMember(member) {
    const item = el("li");
    item.appendChild(el("strong", { text: member.fullName }));
    if (member.role === "leader") item.appendChild(el("span", { class: "role-tag", text: "Leader" }));
    item.appendChild(mailLink(member.email));
    const details = [];
    if (member.phone) details.push(member.phone);
    if (member.ageGroup) details.push(LABELS.ageGroup[member.ageGroup] || member.ageGroup);
    if (details.length) item.appendChild(el("small", { text: details.join("  |  ") }));
    return item;
  }

  function renderTeam(team) {
    const inPerson = team.participationType === "in-person";
    const leader = team.leader;

    const card = el("article", { class: "team-card", "aria-labelledby": "team-name-" + team.id });

    card.appendChild(
      el("header", { class: "team-card__head" },
        el("div", null,
          el("p", { class: "team-card__id", text: "TEAM " + formatId(team.id) }),
          el("h3", { class: "team-card__name", id: "team-name-" + team.id, text: team.teamName })
        ),
        el("span", { class: "badge" + (inPerson ? "" : " badge--online"), text: LABELS.participation[team.participationType] || team.participationType })
      )
    );

    const meta = el("dl", { class: "team-card__meta" },
      el("div", null, el("dt", { text: "Team size" }), el("dd", { text: String(team.teamSize) })),
      el("div", null, el("dt", { text: "Registration date" }), el("dd", { text: formatDate(team.createdAt) }))
    );
    if (inPerson) {
      meta.appendChild(
        el("div", null, el("dt", { text: "Transportation coverage" }), el("dd", { text: team.transportRequested ? "Requested" : "Not requested" }))
      );
    }
    card.appendChild(meta);

    // Leader + shepherd side by side
    const cols = el("div", { class: "team-card__cols" });
    if (leader) {
      const list = el("dl", null,
        row("Name", leader.fullName),
        row("Email", mailLink(leader.email)),
        row("Phone", leader.phone || "Not provided"),
        row("Age group", LABELS.ageGroup[leader.ageGroup] || "Not provided")
      );
      if (leader.organization) list.appendChild(row("Organization", leader.organization));
      cols.appendChild(el("section", { class: "team-card__section" }, el("h4", { text: "Team leader" }), list));
    }
    if (team.shepherd) {
      cols.appendChild(
        el("section", { class: "team-card__section" },
          el("h4", { text: "Adult shepherd" }),
          el("dl", null,
            row("Name", team.shepherd.fullName),
            row("Email", mailLink(team.shepherd.email)),
            row("Phone", team.shepherd.phone || "Not provided"),
            row("Consent", team.shepherd.consentConfirmed ? "Confirmed for under-18s" : "Not confirmed")
          )
        )
      );
    }
    card.appendChild(cols);

    // Every member, leader first
    const members = el("ol", { class: "team-card__members" });
    team.members.forEach(function (member) { members.appendChild(renderMember(member)); });
    card.appendChild(el("section", { class: "team-card__section" }, el("h4", { text: "Members (" + team.members.length + ")" }), members));

    // Extra registration information
    const extra = el("dl", null);
    extra.appendChild(row("Team skills", team.skills.length ? team.skills.map(function (k) { return LABELS.skills[k] || k; }).join(", ") : "None selected"));
    extra.appendChild(row("Heard about us", LABELS.heardFrom[team.heardFrom] || "Not provided"));
    extra.appendChild(row("Notes", team.notes || "None"));
    extra.appendChild(row("Official registration", team.officialRegistrationConfirmed ? "Confirmed for every member" : "Not confirmed"));
    card.appendChild(el("section", { class: "team-card__section" }, el("h4", { text: "Additional information" }), extra));

    return card;
  }

  function render(teams, summary, query) {
    els.stats.teams.textContent = String(summary.teams);
    els.stats.participants.textContent = String(summary.participants);
    els.stats.inPerson.textContent = String(summary.inPersonTeams);
    els.stats.online.textContent = String(summary.onlineTeams);

    els.list.replaceChildren();
    if (!teams.length) {
      els.count.textContent = "";
      els.list.appendChild(
        el("p", { class: "admin-empty", text: query && query.trim() ? "No teams match your search." : "No teams have registered yet." })
      );
      return;
    }

    els.count.textContent = query && query.trim()
      ? teams.length + (teams.length === 1 ? " team matches" : " teams match") + " your search."
      : teams.length + (teams.length === 1 ? " registered team" : " registered teams") + ", newest first.";
    teams.forEach(function (team) { els.list.appendChild(renderTeam(team)); });
  }

  /* ---------------------------------------------------------------------
     Start: is there already a valid session?
     --------------------------------------------------------------------- */
  function init() {
    els.loginForm.addEventListener("submit", onLogin);
    els.logout.addEventListener("click", onLogout);
    els.refresh.addEventListener("click", function () { loadTeams(els.search.value); });
    els.search.addEventListener("input", onSearchInput);

    api("/api/admin/me")
      .then(function (result) {
        if (result.ok && result.data.signedIn) showDashboard();
        else showLogin();
      })
      .catch(function () {
        showLogin("Could not reach the server. Make sure it is running (npm start).");
      });
  }

  // Both sections start hidden until we know which one to show (avoids a login-form flash).
  els.loginSection.hidden = true;
  init();
})();
