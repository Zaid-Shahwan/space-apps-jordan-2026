/* ==========================================================================
   submission.js
   Everything about sending a completed registration somewhere.

   The registration is POSTed as JSON to SA.config.api.endpoint (/api/register),
   which is handled by the Express server and saved in the SQLite database.
   The server validates everything again; nothing here is trusted.

   The form (form.js) only calls SA.submission.submit(data, token) and reacts to
   the returned promise.
   ========================================================================== */
(function () {
  "use strict";

  const SA = (window.SA = window.SA || {});
  const cfg = SA.config;
  const V = SA.validation;

  /** Error thrown by submit(). `code` is one of: network | timeout | server | validation | duplicate. */
  function SubmissionError(code, message, fieldErrors) {
    this.name = "SubmissionError";
    this.code = code;
    this.message = message;
    this.fieldErrors = fieldErrors || null;
  }
  SubmissionError.prototype = Object.create(Error.prototype);

  function text(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  /**
   * Converts the form state into the JSON document that is sent to the server.
   * `token` identifies this submission attempt so a double click or a retry after
   * a lost response cannot create the team twice.
   */
  function buildPayload(data, token) {
    const inPerson = V.isInPerson(data);
    const shepherd = data.participation.shepherd;

    return {
      schemaVersion: 2,
      clientToken: token || generateToken(),
      event: cfg.siteName + " " + cfg.editionLabel,
      submittedAt: new Date().toISOString(),
      team: {
        name: text(data.team.name),
        size: V.teamSize(data),
        officialRegistrationConfirmed: Boolean(data.team.officialConfirm),
      },
      leader: {
        fullName: text(data.leader.name),
        email: text(data.leader.email),
        phone: V.normalizePhone(data.leader.phone),
        ageGroup: data.leader.ageGroup,
        organization: text(data.leader.organization),
      },
      members: V.activeMembers(data).map(function (member) {
        return { fullName: text(member.name), email: text(member.email), ageGroup: member.ageGroup };
      }),
      participation: {
        type: V.participationType(data),
        transportRequested: inPerson ? Boolean(data.participation.transport) : false,
        shepherd: V.needsShepherd(data)
          ? {
              fullName: text(shepherd.name),
              email: text(shepherd.email),
              phone: V.normalizePhone(shepherd.phone),
              consentConfirmed: Boolean(shepherd.consent),
            }
          : null,
      },
      extra: {
        skills: data.extra.skills.slice(),
        heardFrom: data.extra.heardFrom,
        notes: text(data.extra.notes),
        agreedAccurate: Boolean(data.extra.agreeAccurate),
        agreedContact: Boolean(data.extra.agreeContact),
      },
    };
  }

  /** Random id for one submission attempt (idempotency key for the server). */
  function generateToken() {
    const bytes = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    return Array.prototype.map.call(bytes, function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }

  /* ---------------------------------------------------------------------
     Sending to the server
     --------------------------------------------------------------------- */
  function sendToApi(payload) {
    const controller = "AbortController" in window ? new AbortController() : null;
    const timer = controller ? window.setTimeout(function () { controller.abort(); }, cfg.api.timeoutMs) : null;

    return fetch(cfg.api.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin",
      signal: controller ? controller.signal : undefined,
    })
      .then(function (response) {
        return response
          .json()
          .catch(function () { return {}; })
          .then(function (body) {
            if (response.ok && body && body.team) return { team: body.team, alreadySubmitted: Boolean(body.alreadySubmitted) };
            if (response.status === 422 && body && body.errors)
              throw new SubmissionError("validation", "The server rejected some answers.", body.errors);
            if (response.status === 409)
              throw new SubmissionError("duplicate", (body && body.message) || "This team is already registered.");
            throw new SubmissionError("server", "The server could not accept the registration (status " + response.status + ").");
          });
      })
      .catch(function (error) {
        if (error instanceof SubmissionError) throw error;
        if (error && error.name === "AbortError") throw new SubmissionError("timeout", "The request took too long.");
        throw new SubmissionError("network", "We could not reach the registration service.");
      })
      .then(
        function (result) { if (timer) window.clearTimeout(timer); return result; },
        function (error) { if (timer) window.clearTimeout(timer); throw error; }
      );
  }

  /**
   * Submits a registration. Resolves with { team: { id, teamName, teamSize,
   * participationType }, alreadySubmitted, payload }. Rejects with a SubmissionError.
   */
  function submit(data, token) {
    const check = V.validateAll(data);
    if (!check.valid) {
      return Promise.reject(new SubmissionError("validation", "Some answers need attention.", null));
    }
    const payload = buildPayload(data, token);
    return sendToApi(payload).then(function (result) {
      result.payload = payload;
      return result;
    });
  }

  SA.submission = {
    submit: submit,
    buildPayload: buildPayload,
    generateToken: generateToken,
  };
})();
