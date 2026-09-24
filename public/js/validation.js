/* ==========================================================================
   validation.js
   Pure validation logic for the registration data. No DOM access here, so
   the same rules can be reused on a backend or in tests.

   Data shape
   ----------
   {
     team:          { name, size, officialConfirm },
     leader:        { name, email, phone, ageGroup, organization },
     members:       [ { name, email, ageGroup } ],      // excludes the leader
     participation: { type, transport,          // type: "in-person" (IRBID) | "online"
                      shepherd: { name, email, phone, consent } },
     extra:         { skills[], heardFrom, notes, agreeAccurate, agreeContact }
   }

   Every validator returns an errors object keyed by field path, e.g.
   { "leader.email": "Enter a valid email address." }. Empty object = valid.
   ========================================================================== */
(function (root) {
  "use strict";

  // Runs in the browser (window.SA) and in Node, where the server imports this file
  // so the backend applies exactly the same rules as the form.
  const SA = (root.SA = root.SA || {});
  const cfg = SA.config || require("./config.js");

  /* ---------------------------------------------------------------------
     Primitive checks
     --------------------------------------------------------------------- */
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function clean(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function isEmail(value) {
    return EMAIL_PATTERN.test(clean(value));
  }

  /** Removes spaces, dashes, dots and brackets so "+962 (79) 000-0000" is comparable. */
  function normalizePhone(value) {
    return clean(value).replace(/[\s\-().]/g, "");
  }

  /** International or local numbers: optional "+", then 8 to 15 digits. */
  function isPhone(value) {
    return /^\+?\d{8,15}$/.test(normalizePhone(value));
  }

  /** At least two characters and at least one letter (any script, incl. Arabic). */
  function isPersonName(value) {
    const text = clean(value);
    return text.length >= 2 && /\p{L}/u.test(text);
  }

  /* ---------------------------------------------------------------------
     Data helpers
     --------------------------------------------------------------------- */
  function createEmptyData() {
    return {
      team: { name: "", size: "", officialConfirm: false },
      leader: { name: "", email: "", phone: "", ageGroup: "", organization: "" },
      members: [],
      participation: {
        type: "",
        transport: false,
        shepherd: { name: "", email: "", phone: "", consent: false },
      },
      extra: { skills: [], heardFrom: "", notes: "", agreeAccurate: false, agreeContact: false },
    };
  }

  /** Team size as a number, or NaN if it is not a valid selection. */
  function teamSize(data) {
    const size = Number(data.team.size);
    return Number.isInteger(size) && size >= cfg.team.min && size <= cfg.team.max ? size : NaN;
  }

  /** Number of members besides the leader. */
  function memberCount(data) {
    const size = teamSize(data);
    return Number.isNaN(size) ? 0 : size - 1;
  }

  /** Members that count towards the current team size. */
  function activeMembers(data) {
    return data.members.slice(0, memberCount(data));
  }

  function anyMinor(data) {
    if (data.leader.ageGroup === "minor") return true;
    return activeMembers(data).some(function (member) {
      return member && member.ageGroup === "minor";
    });
  }

  /** Participation type: "in-person" (IRBID, Jordan) or "online" (from anywhere in the world). */
  function participationType(data) {
    const type = data.participation.type;
    return type === "in-person" || type === "online" ? type : "";
  }

  function isInPerson(data) {
    return participationType(data) === "in-person";
  }

  /** A parent/guardian contact is required whenever any team member is under 18. */
  function needsShepherd(data) {
    return anyMinor(data);
  }

  function teamEmails(data) {
    const list = [clean(data.leader.email).toLowerCase()];
    activeMembers(data).forEach(function (member) {
      list.push(clean(member && member.email).toLowerCase());
    });
    return list.filter(Boolean);
  }

  /* ---------------------------------------------------------------------
     Step validators
     --------------------------------------------------------------------- */
  function validateTeam(data) {
    const errors = {};
    const team = data.team;
    const name = clean(team.name);

    if (!name) errors["team.name"] = "Enter your team name.";
    else if (name.length < 2 || name.length > 60) errors["team.name"] = "Team name must be between 2 and 60 characters.";

    if (!team.size) errors["team.size"] = "Choose how many people are on your team, including you.";
    else if (Number.isNaN(teamSize(data)))
      errors["team.size"] = "Teams have " + cfg.team.min + " to " + cfg.team.max + " people.";

    if (!team.officialConfirm)
      errors["team.officialConfirm"] =
        "Confirm that every team member has registered on the official NASA Space Apps website.";

    return errors;
  }

  function validateLeader(data) {
    const errors = {};
    const leader = data.leader;

    if (!clean(leader.name)) errors["leader.name"] = "Enter your full name.";
    else if (!isPersonName(leader.name)) errors["leader.name"] = "Enter your full name using letters.";

    if (!clean(leader.email)) errors["leader.email"] = "Enter your email address.";
    else if (!isEmail(leader.email)) errors["leader.email"] = "Enter a valid email address, like name@example.com.";

    if (!clean(leader.phone)) errors["leader.phone"] = "Enter a phone number we can reach you on.";
    else if (!isPhone(leader.phone))
      errors["leader.phone"] = "Enter a valid phone number, for example +962 7X XXX XXXX.";

    if (!leader.ageGroup) errors["leader.ageGroup"] = "Select your age group.";

    if (clean(leader.organization).length > 100)
      errors["leader.organization"] = "Keep this under 100 characters.";

    return errors;
  }

  function validateMembers(data) {
    const errors = {};
    const count = memberCount(data);

    // A team size that is not valid yet: members cannot be checked.
    if (Number.isNaN(teamSize(data))) {
      errors["members._"] = "Choose your team size in step 1 so we know how many members to add.";
      return errors;
    }
    // Team of one: the leader is the whole team, nothing to check.
    if (count === 0) return errors;

    const seen = {};
    const leaderEmail = clean(data.leader.email).toLowerCase();
    if (leaderEmail) seen[leaderEmail] = true;

    for (let i = 0; i < count; i += 1) {
      const member = data.members[i] || { name: "", email: "", ageGroup: "" };
      const prefix = "members." + i + ".";

      if (!clean(member.name)) errors[prefix + "name"] = "Enter this member's full name.";
      else if (!isPersonName(member.name)) errors[prefix + "name"] = "Enter the name using letters.";

      const email = clean(member.email).toLowerCase();
      if (!email) errors[prefix + "email"] = "Enter this member's email address.";
      else if (!isEmail(email)) errors[prefix + "email"] = "Enter a valid email address, like name@example.com.";
      else if (seen[email]) errors[prefix + "email"] = "This email is already used on your team. Each person needs their own.";
      else seen[email] = true;

      if (!member.ageGroup) errors[prefix + "ageGroup"] = "Select this member's age group.";
    }
    return errors;
  }

  function validateLocation(data) {
    const errors = {};
    const part = data.participation;

    if (!participationType(data)) {
      errors["participation.type"] = "Choose how your team will take part.";
      return errors;
    }

    if (needsShepherd(data)) {
      const shepherd = part.shepherd;
      const emails = teamEmails(data);

      if (!clean(shepherd.name)) errors["participation.shepherd.name"] = "Enter the adult shepherd's full name.";
      else if (!isPersonName(shepherd.name)) errors["participation.shepherd.name"] = "Enter the name using letters.";

      const shepherdEmail = clean(shepherd.email).toLowerCase();
      if (!shepherdEmail) errors["participation.shepherd.email"] = "Enter the shepherd's email address.";
      else if (!isEmail(shepherdEmail))
        errors["participation.shepherd.email"] = "Enter a valid email address, like name@example.com.";
      else if (emails.indexOf(shepherdEmail) !== -1)
        errors["participation.shepherd.email"] = "The shepherd must be a separate contact from your team members.";

      if (!clean(shepherd.phone)) errors["participation.shepherd.phone"] = "Enter the shepherd's phone number.";
      else if (!isPhone(shepherd.phone))
        errors["participation.shepherd.phone"] = "Enter a valid phone number, for example +962 7X XXX XXXX.";
      else if (normalizePhone(shepherd.phone) === normalizePhone(data.leader.phone))
        errors["participation.shepherd.phone"] = "The shepherd must be a separate contact from your team leader.";

      if (!shepherd.consent)
        errors["participation.shepherd.consent"] =
          "Confirm that signed consent will be provided for every participant under 18.";
    }
    return errors;
  }

  function validateDetails(data) {
    const errors = {};
    const extra = data.extra;

    if (clean(extra.notes).length > 500) errors["extra.notes"] = "Keep your notes under 500 characters.";
    if (!extra.agreeAccurate)
      errors["extra.agreeAccurate"] = "Confirm that the information is accurate and you may register this team.";
    if (!extra.agreeContact)
      errors["extra.agreeContact"] = "Agree to be contacted about the event to complete your registration.";
    return errors;
  }

  const VALIDATORS = {
    team: validateTeam,
    leader: validateLeader,
    members: validateMembers,
    location: validateLocation,
    details: validateDetails,
    review: function () {
      return {};
    },
  };

  /** Validates one step by id ("team", "leader", ...). */
  function validateStep(stepId, data) {
    const validator = VALIDATORS[stepId];
    return validator ? validator(data) : {};
  }

  /**
   * Validates every step. Returns the errors grouped by step and the index
   * (1-based) of the first step that has a problem, or 0 if everything is valid.
   */
  function validateAll(data) {
    const byStep = {};
    let firstInvalid = 0;
    cfg.steps.forEach(function (step, index) {
      const errors = validateStep(step.id, data);
      if (Object.keys(errors).length) {
        byStep[step.id] = errors;
        if (!firstInvalid) firstInvalid = index + 1;
      }
    });
    return { byStep: byStep, firstInvalid: firstInvalid, valid: firstInvalid === 0 };
  }

  SA.validation = {
    isEmail: isEmail,
    isPhone: isPhone,
    normalizePhone: normalizePhone,
    isPersonName: isPersonName,
    createEmptyData: createEmptyData,
    teamSize: teamSize,
    memberCount: memberCount,
    activeMembers: activeMembers,
    anyMinor: anyMinor,
    participationType: participationType,
    isInPerson: isInPerson,
    needsShepherd: needsShepherd,
    validateStep: validateStep,
    validateAll: validateAll,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = SA.validation;
})(typeof window !== "undefined" ? window : globalThis);
