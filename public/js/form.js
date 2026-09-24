/* ==========================================================================
   form.js
   The registration form controller. It wires the markup in register.html to
   the pure logic in validation.js, storage.js and submission.js.

   Sections (search for the banner comments):
     1. Setup and shared state
     2. Small helpers
     3. Draft persistence (localStorage)
     4. Binding inputs <-> state
     5. Error display (inline + summary)
     6. Progress tracker and step navigation
     7. Step-specific UI (members, participation, notes)
     8. Review step
     9. Submission and success / error states
    10. Clear saved progress dialog
    11. Init
   ========================================================================== */
(function () {
  "use strict";

  const SA = (window.SA = window.SA || {});
  const cfg = SA.config;
  const V = SA.validation;
  const Store = SA.storage;

  const app = document.getElementById("registration-app");
  if (!app) return; // Not the registration page.

  /* =======================================================================
     1. SETUP AND SHARED STATE
     ======================================================================= */
  const form = document.getElementById("registration-form");
  const sections = Array.prototype.slice.call(form.querySelectorAll(".step"));
  const TOTAL = cfg.steps.length;

  const ui = {
    appBody: document.getElementById("app-body"),
    status: document.getElementById("form-status"),
    alert: document.getElementById("form-alert"),
    back: document.getElementById("btn-back"),
    next: document.getElementById("btn-next"),
    nextLabel: document.getElementById("btn-next-label"),
    savedNote: document.getElementById("saved-note"),
    clearBtn: document.getElementById("btn-clear"),
    dialog: document.getElementById("clear-dialog"),
    restoreBanner: document.getElementById("restore-banner"),
    restoreDismiss: document.getElementById("restore-dismiss"),
    tracker: document.getElementById("tracker"),
    trackerSteps: document.getElementById("tracker-steps"),
    trackerCount: document.getElementById("tracker-count"),
    trackerPct: document.getElementById("tracker-pct"),
    trackerRail: document.getElementById("tracker-rail"),
    trackerFill: document.getElementById("tracker-fill"),
    members: document.getElementById("members-container"),
    membersIntro: document.getElementById("members-intro"),
    inPersonNote: document.getElementById("in-person-note"),
    shepherdBlock: document.getElementById("shepherd-block"),
    minorOnlineNote: document.getElementById("minor-online-note"),
    notesCount: document.getElementById("notes-count"),
    review: document.getElementById("review-container"),
    submitting: document.getElementById("submitting"),
    success: document.getElementById("success-panel"),
    successText: document.getElementById("success-text"),
    successRef: document.getElementById("success-ref"),
    successTeam: document.getElementById("success-team"),
    successPlace: document.getElementById("success-place"),
    download: document.getElementById("btn-download"),
    restart: document.getElementById("btn-restart"),
  };

  const state = {
    step: 1,
    maxStep: 1, // furthest step the user has unlocked
    data: V.createEmptyData(),
    editingFromReview: false,
    submitting: false,
    done: false,
    lastResult: null,
    submissionToken: null, // one id per submission attempt; reset whenever an answer changes
  };

  /** Fields the user has left at least once (drives "valid" ticks). */
  const touched = new Set();
  /** Errors currently shown on screen: path -> message. */
  const shown = new Map();

  /* Human-readable labels for stored option values. */
  const LABELS = {
    ageGroup: { adult: "18 or older", minor: "Under 18" },
    participation: {
      "in-person": "In person in IRBID, Jordan",
      online: "Online, from anywhere in the world",
    },
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
      returning: "I took part before",
      organizer: "MENA ORG",
      other: "Somewhere else",
    },
  };

  /* =======================================================================
     2. SMALL HELPERS
     ======================================================================= */
  function getPath(object, path) {
    return path.split(".").reduce(function (node, key) {
      return node == null ? undefined : node[key];
    }, object);
  }

  /** Sets object[path] = value, creating intermediate objects/arrays as needed. */
  function setPath(object, path, value) {
    const keys = path.split(".");
    let node = object;
    for (let i = 0; i < keys.length - 1; i += 1) {
      const key = keys[i];
      if (node[key] == null || typeof node[key] !== "object") {
        node[key] = /^\d+$/.test(keys[i + 1]) ? [] : {};
      }
      node = node[key];
    }
    node[keys[keys.length - 1]] = value;
  }

  function idFor(path) {
    return path.replace(/[^a-z0-9]+/gi, "-");
  }

  function stepId(step) {
    return cfg.steps[(step || state.step) - 1].id;
  }

  function pad(number) {
    return String(number).padStart(2, "0");
  }

  /** Team ids are shown as #001, #002 ... */
  function formatTeamId(id) {
    return "#" + String(id).padStart(3, "0");
  }

  /** Tiny DOM builder. `text` uses textContent, so user data is never parsed as HTML. */
  function el(tag, props) {
    const node = document.createElement(tag);
    Object.keys(props || {}).forEach(function (key) {
      const value = props[key];
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key === "html") node.innerHTML = value; // only ever used with static markup
      else node.setAttribute(key, value);
    });
    for (let i = 2; i < arguments.length; i += 1) {
      const child = arguments[i];
      if (child == null || child === false) continue;
      node.append(child.nodeType ? child : document.createTextNode(String(child)));
    }
    return node;
  }

  function announce(message) {
    ui.status.textContent = "";
    // A tick later so screen readers register the change even for repeated text.
    window.setTimeout(function () {
      ui.status.textContent = message;
    }, 30);
  }

  function isBlank(value) {
    if (typeof value === "string") return value.trim() === "";
    if (typeof value === "boolean") return value === false;
    if (Array.isArray(value)) return value.every(isBlank);
    if (value && typeof value === "object") return Object.keys(value).every(function (k) { return isBlank(value[k]); });
    return value == null;
  }

  function debounce(fn, wait) {
    let timer = null;
    const debounced = function () {
      window.clearTimeout(timer);
      timer = window.setTimeout(fn, wait);
    };
    debounced.flush = function () {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
        fn();
      }
    };
    return debounced;
  }

  /* =======================================================================
     3. DRAFT PERSISTENCE
     ======================================================================= */
  const str = function (v) { return typeof v === "string" ? v : ""; };
  const oneOf = function (v, list) { return list.indexOf(v) !== -1 ? v : ""; };

  /** Rebuilds a safe data object from whatever is in localStorage. */
  function hydrate(saved) {
    const data = V.createEmptyData();
    if (!saved || typeof saved !== "object") return data;
    const t = saved.team || {};
    const l = saved.leader || {};
    const p = saved.participation || {};
    const s = p.shepherd || {};
    const x = saved.extra || {};
    const ages = ["adult", "minor"];

    data.team = { name: str(t.name), size: str(t.size), officialConfirm: t.officialConfirm === true };
    data.leader = {
      name: str(l.name),
      email: str(l.email),
      phone: str(l.phone),
      ageGroup: oneOf(l.ageGroup, ages),
      organization: str(l.organization),
    };
    data.members = (Array.isArray(saved.members) ? saved.members : [])
      .slice(0, cfg.team.max - 1)
      .map(function (m) {
        m = m || {};
        return { name: str(m.name), email: str(m.email), ageGroup: oneOf(m.ageGroup, ages) };
      });
    data.participation = {
      type: oneOf(p.type, ["in-person", "online"]),
      transport: p.transport === true,
      shepherd: { name: str(s.name), email: str(s.email), phone: str(s.phone), consent: s.consent === true },
    };
    data.extra = {
      skills: (Array.isArray(x.skills) ? x.skills : []).filter(function (k) { return LABELS.skills[k]; }),
      heardFrom: oneOf(x.heardFrom, Object.keys(LABELS.heardFrom)),
      notes: str(x.notes).slice(0, 500),
      agreeAccurate: x.agreeAccurate === true,
      agreeContact: x.agreeContact === true,
    };
    return data;
  }

  const storageOk = Store.isAvailable();
  const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

  function saveDraftNow() {
    if (state.done || !storageOk) return;
    const ok = Store.saveDraft({ step: state.step, maxStep: state.maxStep, data: state.data });
    if (ok) ui.savedNote.textContent = "Saved on this device at " + timeFormat.format(new Date());
  }
  const scheduleSave = debounce(saveDraftNow, 300);

  function describeStorage() {
    if (!storageOk) {
      ui.savedNote.textContent =
        "Saving is unavailable in this browser (private mode?). Keep this page open until you submit.";
      ui.savedNote.classList.add("is-warning");
    }
  }

  /* =======================================================================
     4. BINDING INPUTS <-> STATE
     ======================================================================= */
  function writeControl(control) {
    const value = getPath(state.data, control.name);
    if (control.type === "checkbox") {
      if (control.hasAttribute("data-multi")) control.checked = Array.isArray(value) && value.indexOf(control.value) !== -1;
      else control.checked = value === true;
    } else if (control.type === "radio") {
      control.checked = value === control.value;
    } else {
      control.value = value == null ? "" : value;
    }
  }

  function populateWithin(container) {
    Array.prototype.forEach.call(container.querySelectorAll("[name]"), writeControl);
  }

  /** Copies one control's value into state. */
  function readControl(control) {
    const path = control.name;
    if (control.type === "checkbox") {
      if (control.hasAttribute("data-multi")) {
        const checked = form.querySelectorAll('input[name="' + path + '"]:checked');
        setPath(state.data, path, Array.prototype.map.call(checked, function (c) { return c.value; }));
      } else {
        setPath(state.data, path, control.checked);
      }
    } else if (control.type === "radio") {
      if (control.checked) setPath(state.data, path, control.value);
    } else {
      setPath(state.data, path, control.value);
    }
  }

  function onFieldInput(event) {
    const control = event.target;
    if (!control.name || !form.contains(control)) return;
    readControl(control);
    state.submissionToken = null; // an answer changed, so this is a new submission

    if (control.name === "extra.notes") updateNotesCount();
    if (control.name.indexOf("participation.") === 0 || control.name.indexOf("leader.ageGroup") === 0) refreshLocationUi();

    // Clear errors as soon as they are fixed, and keep the "valid" ticks honest.
    const errors = V.validateStep(stepId(), state.data);
    refreshShownErrors(errors);
    if (touched.has(control.name) && !shown.has(control.name)) setValidMark(control.name, !errors[control.name]);

    scheduleSave();
  }

  /*
   * Blur validation inserts an error message, which can push the button the
   * user is pressing out from under the pointer and swallow the click. So while
   * the pointer is held on something clickable, the blur check is postponed
   * until the click has finished.
   */
  const CLICKABLE = "button, a, label, summary, select, input[type='radio'], input[type='checkbox']";
  let pointerHeld = false;
  let pendingBlur = null;

  function beginPointer(event) {
    pointerHeld = Boolean(event.target.closest && event.target.closest(CLICKABLE));
  }

  function endPointer() {
    if (!pointerHeld) return;
    pointerHeld = false;
    window.setTimeout(flushPendingBlur, 60);
  }

  function flushPendingBlur() {
    const path = pendingBlur;
    pendingBlur = null;
    if (path && !state.submitting && fieldEl(path)) validateBlurred(path);
  }

  function validateBlurred(path) {
    const errors = V.validateStep(stepId(), state.data);
    if (errors[path]) showError(path, errors[path]);
    else {
      clearError(path);
      setValidMark(path, true);
    }
    refreshShownErrors(errors);
  }

  function onFieldBlur(event) {
    const control = event.target;
    if (!control.name || !form.contains(control)) return;
    const type = control.type;
    if (type === "radio" || type === "checkbox") return; // validated on change instead

    // Tidy stray spaces, then validate this one field.
    if (typeof control.value === "string" && control.value !== control.value.trim()) {
      control.value = control.value.trim();
      readControl(control);
      scheduleSave();
    }
    touched.add(control.name);
    if (pointerHeld) {
      pendingBlur = control.name;
      return;
    }
    validateBlurred(control.name);
  }

  function updateNotesCount() {
    ui.notesCount.textContent = String(state.data.extra.notes.length);
  }

  /* =======================================================================
     5. ERROR DISPLAY
     ======================================================================= */
  function fieldEl(path) {
    return form.querySelector('[data-field="' + path + '"]');
  }

  function controlsOf(field) {
    return Array.prototype.slice.call(field.querySelectorAll("input, select, textarea"));
  }

  function primaryTextControl(field) {
    return field.querySelector("input:not([type=radio]):not([type=checkbox]), select, textarea");
  }

  /** The visible label of a field, for the error summary. */
  function labelOf(path) {
    const field = fieldEl(path);
    if (!field) return "";
    if (field.dataset.label) return field.dataset.label;
    const label = field.querySelector(".field__label, legend, .choice__text strong");
    return label ? label.textContent.replace(/\*|\(required\)/g, "").replace(/\s+/g, " ").trim() : "";
  }

  function showError(path, message) {
    const field = fieldEl(path);
    shown.set(path, message);
    if (!field) return;

    let node = field.querySelector(".field__error");
    if (!node) {
      node = el("p", { class: "field__error", id: "err-" + idFor(path) });
      node.appendChild(el("span", { html: SA.icon("alert", "icon--sm") }));
      node.appendChild(el("span", { class: "field__error-text" }));
      field.appendChild(node);
    }
    node.querySelector(".field__error-text").textContent = message;

    field.classList.add("has-error");
    field.classList.remove("is-valid");

    // Link the message to the control(s) for screen readers.
    const targets = field.matches("fieldset") ? [field].concat(controlsOf(field)) : controlsOf(field);
    targets.forEach(function (control) {
      if (control.dataset.described === undefined) control.dataset.described = control.getAttribute("aria-describedby") || "";
      if (control.tagName !== "FIELDSET") control.setAttribute("aria-invalid", "true");
      if (control.tagName === "FIELDSET" || !field.matches("fieldset")) {
        control.setAttribute("aria-describedby", (control.dataset.described + " " + node.id).trim());
      }
    });
  }

  function clearError(path) {
    shown.delete(path);
    const field = fieldEl(path);
    if (!field) return;
    const node = field.querySelector(".field__error");
    if (node) node.remove();
    field.classList.remove("has-error");
    const targets = field.matches("fieldset") ? [field].concat(controlsOf(field)) : controlsOf(field);
    targets.forEach(function (control) {
      control.removeAttribute("aria-invalid");
      if (control.dataset.described !== undefined) {
        if (control.dataset.described) control.setAttribute("aria-describedby", control.dataset.described);
        else control.removeAttribute("aria-describedby");
      }
    });
  }

  function clearAllErrors() {
    Array.from(shown.keys()).forEach(clearError);
    shown.clear();
    hideAlert();
  }

  function setValidMark(path, isValid) {
    const field = fieldEl(path);
    if (!field) return;
    const control = primaryTextControl(field);
    const worth = isValid && control && String(control.value).trim() !== "" && !field.classList.contains("has-error");
    field.classList.toggle("is-valid", Boolean(worth));
  }

  /** Re-checks errors that are on screen; removes the ones that have been fixed. */
  function refreshShownErrors(errors) {
    if (!shown.size) return;
    Array.from(shown.keys()).forEach(function (path) {
      if (errors[path]) showError(path, errors[path]);
      else clearError(path);
    });
    if (!shown.size) hideAlert();
    else if (ui.alert.dataset.kind === "validation") renderValidationAlert();
  }

  function sortByDom(paths) {
    return paths.slice().sort(function (a, b) {
      const fa = fieldEl(a);
      const fb = fieldEl(b);
      if (!fa) return 1;
      if (!fb) return -1;
      return fa.compareDocumentPosition(fb) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
  }

  function focusField(path) {
    const field = fieldEl(path);
    if (!field) return;
    const control = controlsOf(field)[0];
    if (control) control.focus();
  }

  function renderValidationAlert() {
    const paths = sortByDom(Array.from(shown.keys()));
    const count = paths.length;
    ui.alert.dataset.kind = "validation";
    ui.alert.className = "alert alert--error";
    ui.alert.replaceChildren(
      el("p", { class: "alert__title", text: "Please check your information and try again." }),
      el("p", { class: "alert__text", text: count === 1 ? "1 field needs attention:" : count + " fields need attention:" })
    );
    const list = el("ul", { class: "alert__list" });
    paths.forEach(function (path) {
      const message = shown.get(path);
      const label = labelOf(path);
      const item = el("li");
      if (fieldEl(path)) {
        const link = el("button", { type: "button", class: "alert__link", text: label ? label + ": " + message : message });
        link.addEventListener("click", function () { focusField(path); });
        item.appendChild(link);
      } else {
        item.textContent = message;
      }
      list.appendChild(item);
    });
    ui.alert.appendChild(list);
    ui.alert.hidden = false;
  }

  /** Shows every error of the current step inline and as a summary, then focuses the first. */
  function showStepErrors(errors) {
    const paths = Object.keys(errors);
    Array.from(shown.keys()).forEach(function (p) { if (!errors[p]) clearError(p); });
    paths.forEach(function (path) { showError(path, errors[path]); });
    renderValidationAlert();
    const first = sortByDom(paths).filter(function (p) { return fieldEl(p); })[0];
    if (first) focusField(first);
  }

  function showFailureAlert(title, text) {
    ui.alert.dataset.kind = "failure";
    ui.alert.className = "alert alert--error";
    ui.alert.replaceChildren(
      el("p", { class: "alert__title", text: title }),
      el("p", { class: "alert__text", text: text })
    );
    ui.alert.hidden = false;
    ui.alert.focus();
  }

  function hideAlert() {
    ui.alert.hidden = true;
    ui.alert.replaceChildren();
    delete ui.alert.dataset.kind;
  }

  /* =======================================================================
     6. PROGRESS TRACKER AND STEP NAVIGATION
     ======================================================================= */
  function buildTracker() {
    cfg.steps.forEach(function (step, index) {
      const number = index + 1;
      const button = el("button", { type: "button", class: "tracker__btn", "data-goto": String(number) });
      button.appendChild(
        el("span", { class: "tracker__dot", "aria-hidden": "true" },
          el("span", { class: "tracker__num", text: pad(number) }),
          el("span", { class: "tracker__tick", html: SA.icon("check") })
        )
      );
      button.appendChild(el("span", { class: "tracker__label", text: step.short }));
      button.appendChild(el("span", { class: "sr-only", text: ": step " + number + " of " + TOTAL + ", " + step.title }));
      ui.trackerSteps.appendChild(el("li", { class: "tracker__step", "data-step": String(number) }, button));
    });

    ui.trackerSteps.addEventListener("click", function (event) {
      const button = event.target.closest("[data-goto]");
      if (!button || button.disabled) return;
      requestStep(Number(button.dataset.goto));
    });
  }

  function updateTracker() {
    const pct = state.done ? 100 : Math.round(((state.step - 1) / TOTAL) * 100);
    ui.trackerPct.textContent = String(pct);
    ui.trackerFill.style.transform = "scaleX(" + pct / 100 + ")";
    ui.trackerRail.setAttribute("aria-valuenow", String(pct));
    ui.trackerCount.textContent = state.done
      ? "Registration complete"
      : "Step " + state.step + " of " + TOTAL + " \u00b7 " + cfg.steps[state.step - 1].title;

    Array.prototype.forEach.call(ui.trackerSteps.children, function (li, index) {
      const number = index + 1;
      const button = li.firstElementChild;
      const complete = state.done || number < state.maxStep;
      const current = !state.done && number === state.step;
      li.classList.toggle("is-complete", complete);
      li.classList.toggle("is-current", current);
      button.disabled = state.done || number > state.maxStep;
      if (current) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
  }

  function updateControls() {
    ui.back.hidden = state.step === 1;
    const last = state.step === TOTAL;
    let label = "Next";
    if (last) label = "Submit registration";
    else if (state.editingFromReview) label = "Save and review";
    ui.nextLabel.textContent = label;
  }

  /** Shows a step. `direction` ("forward" | "back") picks the transition. */
  function showStep(number, options) {
    const opts = options || {};
    const direction = opts.direction || (number < state.step ? "back" : "forward");

    clearAllErrors();
    touched.clear();
    pendingBlur = null;
    state.step = number;

    sections.forEach(function (section) {
      const active = Number(section.dataset.step) === number;
      section.classList.remove("is-enter-forward", "is-enter-back");
      section.hidden = !active;
      if (active) section.classList.add(direction === "back" ? "is-enter-back" : "is-enter-forward");
    });

    onEnterStep(number);
    updateTracker();
    updateControls();
    saveDraftNow();

    if (opts.focus !== false) {
      const title = document.getElementById("step-title-" + number);
      announce("Step " + number + " of " + TOTAL + ": " + cfg.steps[number - 1].title + ".");
      if (title) title.focus({ preventScroll: true });
      const smooth = !SA.ui.prefersReducedMotion();
      app.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
    }
  }

  function onEnterStep(number) {
    const id = stepId(number);
    if (id === "members") renderMembers();
    if (id === "location") refreshLocationUi();
    if (id === "details") updateNotesCount();
    if (id === "review") renderReview();
  }

  function goNext() {
    const errors = V.validateStep(stepId(), state.data);
    if (Object.keys(errors).length) {
      showStepErrors(errors);
      return;
    }

    if (state.editingFromReview) {
      // Return to the review step, but first make sure the change did not break another step.
      const check = V.validateAll(state.data);
      if (!check.valid && check.firstInvalid !== state.step) {
        const target = check.firstInvalid;
        state.maxStep = Math.max(state.maxStep, target);
        showStep(target, { direction: target < state.step ? "back" : "forward" });
        showStepErrors(check.byStep[stepId(target)]);
        announce("Your change affects step " + target + ". Please review it.");
        return;
      }
      state.editingFromReview = false;
      state.maxStep = TOTAL;
      showStep(TOTAL, { direction: "forward" });
      return;
    }

    state.maxStep = Math.max(state.maxStep, state.step + 1);
    showStep(state.step + 1, { direction: "forward" });
  }

  function goBack() {
    if (state.step > 1) showStep(state.step - 1, { direction: "back" });
  }

  /** Jump requested from the tracker or the review Edit buttons. */
  function requestStep(target) {
    if (target === state.step || target > state.maxStep) return;
    if (target > state.step) {
      // Moving forward always validates the step being left.
      const errors = V.validateStep(stepId(), state.data);
      if (Object.keys(errors).length) {
        showStepErrors(errors);
        return;
      }
    }
    showStep(target);
  }

  /* =======================================================================
     7. STEP-SPECIFIC UI
     ======================================================================= */

  /* ---- Step 3: one card per additional member ------------------------- */
  function renderMembers() {
    const count = V.memberCount(state.data);
    ui.members.replaceChildren();

    if (V.teamSize(state.data) === 1) {
      ui.membersIntro.textContent = "Your team is just you, so there are no other members to add.";
      ui.members.appendChild(el("div", { class: "notice notice--info" },
        el("span", { html: SA.icon("info") }),
        el("p", { text: "Team of 1: the team leader is the whole team. Continue to the next step." })
      ));
      return;
    }

    if (!count) {
      ui.membersIntro.textContent = "Choose your team size first so we know how many members to add.";
      const notice = el("div", { class: "notice notice--info" },
        el("span", { html: SA.icon("info") }),
        el("p", { text: "Your team size is not set yet." })
      );
      const back = el("button", { type: "button", class: "btn btn--ghost btn--sm", text: "Go to step 1" });
      back.addEventListener("click", function () { showStep(1, { direction: "back" }); });
      notice.appendChild(back);
      ui.members.appendChild(notice);
      return;
    }

    ui.membersIntro.textContent =
      "Your team has " + (count + 1) + " people. You are member 1, so add " + count +
      (count === 1 ? " more person" : " more people") + ". Each person needs their own email address.";

    while (state.data.members.length < count) state.data.members.push({ name: "", email: "", ageGroup: "" });

    for (let i = 0; i < count; i += 1) {
      const number = i + 2;
      const base = "members." + i + ".";
      const card = el("article", { class: "member" });
      card.innerHTML =
        '<header class="member__head"><span class="member__badge">Member ' + number + "</span></header>" +
        '<div class="field-grid">' +
        '<div class="field" data-field="' + base + 'name" data-label="Member ' + number + ': full name">' +
        '<label class="field__label" for="member-' + i + '-name">Full name <span class="req" aria-hidden="true">*</span></label>' +
        '<input class="input" id="member-' + i + '-name" name="' + base + 'name" type="text" dir="auto" maxlength="80" autocomplete="off" placeholder="Full name" required></div>' +
        '<div class="field" data-field="' + base + 'email" data-label="Member ' + number + ': email">' +
        '<label class="field__label" for="member-' + i + '-email">Email address <span class="req" aria-hidden="true">*</span></label>' +
        '<input class="input" id="member-' + i + '-email" name="' + base + 'email" type="email" inputmode="email" maxlength="120" autocomplete="off" placeholder="name@example.com" required></div>' +
        "</div>" +
        '<fieldset class="field" data-field="' + base + 'ageGroup" data-label="Member ' + number + ': age group">' +
        '<legend class="field__label">Age group <span class="req" aria-hidden="true">*</span><span class="sr-only">(required)</span></legend>' +
        '<div class="choice-row">' +
        '<label class="choice choice--card"><input type="radio" name="' + base + 'ageGroup" value="adult" required><span class="choice__ui" aria-hidden="true"></span><span class="choice__text"><strong>18 or older</strong></span></label>' +
        '<label class="choice choice--card"><input type="radio" name="' + base + 'ageGroup" value="minor" required><span class="choice__ui" aria-hidden="true"></span><span class="choice__text"><strong>Under 18</strong></span></label>' +
        "</div></fieldset>";
      ui.members.appendChild(card);
    }
    populateWithin(ui.members);
  }

  /* ---- Step 4: conditional blocks -------------------------------------- */
  function refreshLocationUi() {
    const part = state.data.participation;
    const inPerson = V.isInPerson(state.data);
    const needsShepherd = V.needsShepherd(state.data);
    const wasShepherdVisible = !ui.shepherdBlock.hidden;

    ui.inPersonNote.hidden = !inPerson;
    ui.shepherdBlock.hidden = !needsShepherd;
    ui.minorOnlineNote.hidden = !(V.anyMinor(state.data) && Boolean(part.type) && !inPerson);

    // Errors on blocks that just disappeared must not linger.
    if (wasShepherdVisible && !needsShepherd) {
      Array.from(shown.keys()).forEach(function (path) {
        if (path.indexOf("participation.shepherd.") === 0) clearError(path);
      });
    }
  }

  /* =======================================================================
     8. REVIEW STEP
     ======================================================================= */
  function reviewRow(label, value) {
    const dd = el("dd");
    (Array.isArray(value) ? value : [value]).forEach(function (line, index) {
      dd.appendChild(el("span", { class: index === 0 ? "review__main" : "review__sub", text: line }));
    });
    return el("div", { class: "review__row" }, el("dt", { text: label }), dd);
  }

  function reviewSection(title, stepNumber, rows) {
    const edit = el("button", { type: "button", class: "link-btn", "data-edit": String(stepNumber) });
    edit.innerHTML = SA.icon("edit", "icon--xs") + " Edit";
    edit.appendChild(el("span", { class: "sr-only", text: " " + title.toLowerCase() }));
    const list = el("dl", { class: "review__list" });
    rows.forEach(function (row) { list.appendChild(reviewRow(row[0], row[1])); });
    return el("section", { class: "review__section" },
      el("header", { class: "review__head" }, el("h4", { text: title }), edit),
      list
    );
  }

  function attendanceText(data) {
    return LABELS.participation[V.participationType(data)] || "Not chosen";
  }

  function renderReview() {
    const d = state.data;
    ui.review.replaceChildren();

    const check = V.validateAll(d);
    if (!check.valid) {
      const notice = el("div", { class: "notice notice--error" },
        el("span", { html: SA.icon("alert") }),
        el("p", { text: "Some answers need attention before you can submit: " +
          Object.keys(check.byStep).map(function (id) {
            const step = cfg.steps.filter(function (s) { return s.id === id; })[0];
            return step.title.toLowerCase();
          }).join(", ") + "." })
      );
      ui.review.appendChild(notice);
    }

    ui.review.appendChild(reviewSection("Team information", 1, [
      ["Team name", d.team.name || "Not set"],
      ["Team size", V.teamSize(d) ? V.teamSize(d) + " people" : "Not set"],
      ["Official registration", d.team.officialConfirm ? "Confirmed for every member" : "Not confirmed"],
    ]));

    ui.review.appendChild(reviewSection("Team leader", 2, [
      ["Name", d.leader.name || "Not set"],
      ["Email", d.leader.email || "Not set"],
      ["Phone", d.leader.phone || "Not set"],
      ["Age group", LABELS.ageGroup[d.leader.ageGroup] || "Not set"],
      ["School, university or company", d.leader.organization || "Not provided"],
    ]));

    const memberRows = V.activeMembers(d).map(function (m, i) {
      return ["Member " + (i + 2), [m.name || "Name missing", (m.email || "Email missing") + "  |  " + (LABELS.ageGroup[m.ageGroup] || "Age group missing")]];
    });
    ui.review.appendChild(reviewSection("Team members", 3, memberRows.length ? memberRows : [["Members", V.teamSize(d) === 1 ? "None (team of 1)" : "No members added yet"]]));

    const part = d.participation;
    const partRows = [
      ["Participation", attendanceText(d)],
    ];
    if (V.needsShepherd(d)) {
      partRows.push(["Parent/guardian contact", [part.shepherd.name || "Name missing", (part.shepherd.email || "Email missing") + "  |  " + (part.shepherd.phone || "Phone missing")]]);
      partRows.push(["Consent for under 18s", part.shepherd.consent ? "Will be provided" : "Not confirmed"]);
    }
    ui.review.appendChild(reviewSection("Participation and location", 4, partRows));

    ui.review.appendChild(reviewSection("Additional information", 5, [
      ["Team skills", d.extra.skills.length ? d.extra.skills.map(function (k) { return LABELS.skills[k]; }).join(", ") : "None selected"],
      ["Heard about us via", LABELS.heardFrom[d.extra.heardFrom] || "Not provided"],
      ["Notes", d.extra.notes.trim() || "None"],
      ["Agreements", d.extra.agreeAccurate && d.extra.agreeContact ? "Accuracy confirmed. Contact agreed." : "Not confirmed"],
    ]));
  }

  /* =======================================================================
     9. SUBMISSION AND RESULT STATES
     ======================================================================= */
  function setSubmitting(active) {
    state.submitting = active;
    ui.submitting.hidden = !active;
    ui.appBody.classList.toggle("is-busy", active);
    ui.next.disabled = active;
    ui.back.disabled = active;
    if (active) form.setAttribute("inert", "");
    else form.removeAttribute("inert");
    ui.appBody.setAttribute("aria-busy", active ? "true" : "false");
    if (active) announce("Submitting your registration.");
  }

  function submitRegistration() {
    const check = V.validateAll(state.data);
    if (!check.valid) {
      // Something earlier is invalid (for example the team size changed). Send the user there.
      const target = check.firstInvalid;
      state.editingFromReview = true;
      state.maxStep = Math.max(state.maxStep, target);
      showStep(target, { direction: "back" });
      showStepErrors(check.byStep[stepId(target)]);
      return;
    }

    hideAlert();
    setSubmitting(true);
    // Same token for retries of the same answers, so the server never creates the team twice.
    if (!state.submissionToken) state.submissionToken = SA.submission.generateToken();
    SA.submission.submit(state.data, state.submissionToken).then(handleSuccess, handleFailure);
  }

  function handleSuccess(result) {
    setSubmitting(false);
    state.done = true;
    state.lastResult = result;
    Store.clearDraft();

    state.submissionToken = null;
    const team = result.team;
    ui.successText.textContent =
      "Your team has been successfully registered for NASA Space Apps Challenge IRBID 2026. " +
      "We will use the email address you provided if we need to reach your team.";
    ui.successRef.textContent = formatTeamId(team.id);
    ui.successTeam.textContent = team.teamName;
    ui.successPlace.textContent = LABELS.participation[team.participationType] || team.participationType;

    ui.restoreBanner.hidden = true; // "progress restored" no longer applies
    ui.appBody.hidden = true;
    ui.success.hidden = false;
    updateTracker();
    // Focus the heading so screen readers announce the result (the live region is inside the hidden form).
    document.getElementById("success-title").focus({ preventScroll: true });
    app.scrollIntoView({ behavior: SA.ui.prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }

  function handleFailure(error) {
    setSubmitting(false);
    const code = error && error.code;

    if (code === "validation" && error.fieldErrors) {
      // The server rejected specific fields: show them on the step that owns each field.
      const paths = Object.keys(error.fieldErrors);
      const owner = ownerStepOf(paths[0]);
      if (owner) {
        state.editingFromReview = true;
        showStep(owner, { direction: "back" });
        const errors = {};
        paths.forEach(function (p) { if (ownerStepOf(p) === owner && fieldEl(p)) errors[p] = String(error.fieldErrors[p]); });
        if (Object.keys(errors).length) {
          showStepErrors(errors);
          return;
        }
      }
    }

    let text = "We could not send your registration. Your answers are saved on this device, so you can try again.";
    if (code === "network") text = "We could not reach the registration service. Check your internet connection, then try again. Your answers are saved on this device.";
    else if (code === "timeout") text = "The registration service took too long to answer. Please try again. Your answers are saved on this device.";
    else if (code === "duplicate") text = "This team looks like it is already registered (same team name and leader email). If that was you, there is nothing more to do. Otherwise, change the team name or the leader's email and try again.";
    else if (code === "server") text = "The registration service could not accept your registration right now. Please try again in a few minutes. Your answers are saved on this device.";
    showFailureAlert("Something went wrong.", text);
  }

  /** Finds which step a field path belongs to. */
  function ownerStepOf(path) {
    if (!path) return 0;
    const prefix = path.split(".")[0];
    const map = { team: 1, leader: 2, members: 3, participation: 4, extra: 5 };
    return map[prefix] || 0;
  }

  function downloadCopy() {
    if (!state.lastResult) return;
    const record = { teamId: state.lastResult.team.id, registration: state.lastResult.payload };
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = el("a", { href: url, download: "space-apps-jordan-2026-team-" + state.lastResult.team.id + ".json" });
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function resetAll(message) {
    state.data = V.createEmptyData();
    state.step = 1;
    state.maxStep = 1;
    state.done = false;
    state.editingFromReview = false;
    state.lastResult = null;
    state.submissionToken = null;
    clearAllErrors();
    touched.clear();
    Array.prototype.forEach.call(form.querySelectorAll("[name]"), writeControl);
    Array.prototype.forEach.call(form.querySelectorAll(".is-valid"), function (n) { n.classList.remove("is-valid"); });
    ui.success.hidden = true;
    ui.appBody.hidden = false;
    ui.restoreBanner.hidden = true;
    showStep(1, { direction: "back" });
    ui.savedNote.textContent = message || "Progress saves on this device as you type.";
  }

  /* =======================================================================
     10. CLEAR SAVED PROGRESS
     ======================================================================= */
  function openClearDialog() {
    if (typeof ui.dialog.showModal === "function") {
      ui.dialog.returnValue = "";
      ui.dialog.showModal();
    } else if (window.confirm("Clear saved progress? This deletes everything you have entered on this device.")) {
      clearSavedProgress();
    }
  }

  function clearSavedProgress() {
    Store.clearDraft();
    resetAll("Saved progress cleared.");
    announce("Saved progress cleared. You are back at step 1.");
  }

  /* =======================================================================
     11. INIT
     ======================================================================= */
  function init() {
    buildTracker();
    describeStorage();

    // Restore a saved draft, if there is one.
    const saved = Store.loadDraft();
    if (saved) {
      state.data = hydrate(saved.data);
      const step = Math.min(Math.max(parseInt(saved.step, 10) || 1, 1), TOTAL);
      state.maxStep = Math.min(Math.max(parseInt(saved.maxStep, 10) || step, step), TOTAL);
      state.step = step;
      if (!isBlank(state.data)) {
        ui.restoreBanner.hidden = false;
        if (saved.savedAt) ui.savedNote.textContent = "Saved on this device at " + timeFormat.format(new Date(saved.savedAt));
      }
    }

    // ?participation=in-person|online (from the Event page) preselects how the team takes part.
    const preset = new URLSearchParams(window.location.search).get("participation");
    if (preset === "in-person" || preset === "online") state.data.participation.type = preset;

    Array.prototype.forEach.call(form.querySelectorAll("[name]"), writeControl);
    updateNotesCount();

    // Events
    form.addEventListener("input", onFieldInput);
    form.addEventListener("change", onFieldInput);
    form.addEventListener("focusout", onFieldBlur);
    document.addEventListener("pointerdown", beginPointer, true);
    document.addEventListener("pointerup", endPointer, true);
    document.addEventListener("pointercancel", endPointer, true);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (state.submitting) return;
      if (state.step === TOTAL) submitRegistration();
      else goNext();
    });
    ui.back.addEventListener("click", goBack);
    ui.review.addEventListener("click", function (event) {
      const button = event.target.closest("[data-edit]");
      if (!button) return;
      state.editingFromReview = true;
      showStep(Number(button.dataset.edit), { direction: "back" });
    });
    ui.clearBtn.addEventListener("click", openClearDialog);
    ui.dialog.addEventListener("close", function () {
      if (ui.dialog.returnValue === "confirm") clearSavedProgress();
    });
    ui.dialog.addEventListener("click", function (event) {
      if (event.target === ui.dialog) ui.dialog.close("cancel");
    });
    ui.restoreDismiss.addEventListener("click", function () { ui.restoreBanner.hidden = true; });
    ui.download.addEventListener("click", downloadCopy);
    ui.restart.addEventListener("click", function () { resetAll(); announce("Started a new registration."); });
    window.addEventListener("pagehide", scheduleSave.flush);

    showStep(state.step, { focus: false, direction: "forward" });
    // showStep saved a draft; if nothing was entered yet, that is harmless (banner logic uses content).
  }

  init();
})();
