/* ==========================================================================
   server/registration.js
   Turns the JSON sent to POST /api/register into a clean, validated record
   ready for the database. The browser is NOT trusted: every value is
   re-checked here.

   The validation rules themselves come from public/js/validation.js, the same
   file the registration form uses, so the frontend and backend cannot drift
   apart. On top of those shared rules this file adds the strict checks that
   only make sense on a server (types, lengths, exact member count, allowed
   values).
   ========================================================================== */
"use strict";

const path = require("node:path");
const config = require(path.join(__dirname, "..", "public", "js", "config.js"));
const V = require(path.join(__dirname, "..", "public", "js", "validation.js"));

const AGE_GROUPS = ["adult", "minor"];
const SKILLS = ["software", "data-ai", "hardware", "design", "science", "storytelling"];
const HEARD_FROM = ["social", "friend", "school", "returning", "organizer", "other"];
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,80}$/;

/** Maximum lengths (the shared rules already cap team name, organization and notes). */
const MAX = { person: 80, email: 120 };

const str = (value) => (typeof value === "string" ? value.trim() : "");
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** Builds the same "form data" shape validation.js expects, from untrusted JSON. */
function toFormData(body) {
  const team = isObject(body.team) ? body.team : {};
  const leader = isObject(body.leader) ? body.leader : {};
  const part = isObject(body.participation) ? body.participation : {};
  const shepherd = isObject(part.shepherd) ? part.shepherd : {};
  const extra = isObject(body.extra) ? body.extra : {};
  const members = Array.isArray(body.members) ? body.members.slice(0, 12) : [];

  const data = V.createEmptyData();
  data.team = {
    name: str(team.name),
    size: typeof team.size === "number" || typeof team.size === "string" ? String(team.size).trim() : "",
    officialConfirm: team.officialRegistrationConfirmed === true,
  };
  data.leader = {
    name: str(leader.fullName),
    email: str(leader.email),
    phone: str(leader.phone),
    ageGroup: str(leader.ageGroup),
    organization: str(leader.organization),
  };
  data.members = members.map((m) => {
    const member = isObject(m) ? m : {};
    return { name: str(member.fullName), email: str(member.email), ageGroup: str(member.ageGroup) };
  });
  data.participation = {
    type: str(part.type),
    transport: part.transportRequested === true,
    shepherd: {
      name: str(shepherd.fullName),
      email: str(shepherd.email),
      phone: str(shepherd.phone),
      consent: shepherd.consentConfirmed === true,
    },
  };
  data.extra = {
    skills: Array.isArray(extra.skills) ? extra.skills.filter((k) => typeof k === "string" && SKILLS.indexOf(k) !== -1) : [],
    heardFrom: HEARD_FROM.indexOf(extra.heardFrom) !== -1 ? extra.heardFrom : "",
    notes: str(extra.notes),
    agreeAccurate: extra.agreedAccurate === true,
    agreeContact: extra.agreedContact === true,
  };
  return { data: data, rawMemberCount: members.length, rawSize: team.size };
}

/**
 * Validates and normalizes a registration request body.
 * Returns { ok: true, record } or { ok: false, errors } where `errors` maps a
 * field path (for example "members.1.email") to a message; the form uses the
 * same paths to show the messages next to the right fields.
 */
function parseRegistration(body) {
  if (!isObject(body)) return { ok: false, errors: { _: "The registration data is missing or not valid." } };

  const { data, rawMemberCount, rawSize } = toFormData(body);
  const errors = {};

  // 1. The shared rules used by the form (all six steps).
  const check = V.validateAll(data);
  Object.keys(check.byStep).forEach((stepId) => Object.assign(errors, check.byStep[stepId]));

  // 2. Team size must be a whole number from min to max, written plainly (no "0x3", "3.0", "1e0").
  const size = V.teamSize(data);
  const plainSize = /^\d$/.test(String(rawSize).trim());
  if (!plainSize && !errors["team.size"]) {
    errors["team.size"] = "Teams have " + config.team.min + " to " + config.team.max + " people.";
  }

  // 3. The number of members must match the team size EXACTLY (leader + size - 1).
  if (!Number.isNaN(size) && rawMemberCount !== size - 1) {
    errors["members._"] = "A team of " + size + " needs the leader and exactly " + (size - 1) + " other member" + (size - 1 === 1 ? "" : "s") + ".";
  }

  // 4. Allowed values and lengths that the form rules do not cover.
  const checkPerson = (prefix, name, email) => {
    if (name.length > MAX.person) errors[prefix + "name"] = "Keep this under " + MAX.person + " characters.";
    if (email.length > MAX.email) errors[prefix + "email"] = "Keep this under " + MAX.email + " characters.";
  };
  checkPerson("leader.", data.leader.name, data.leader.email);
  if (AGE_GROUPS.indexOf(data.leader.ageGroup) === -1) errors["leader.ageGroup"] = errors["leader.ageGroup"] || "Select your age group.";
  data.members.forEach((m, i) => {
    checkPerson("members." + i + ".", m.name, m.email);
    if (AGE_GROUPS.indexOf(m.ageGroup) === -1) errors["members." + i + ".ageGroup"] = errors["members." + i + ".ageGroup"] || "Select this member's age group.";
  });
  if (V.needsShepherd(data)) checkPerson("participation.shepherd.", data.participation.shepherd.name, data.participation.shepherd.email);

  // 5. Optional idempotency token from the browser.
  let clientToken = null;
  if (body.clientToken !== undefined && body.clientToken !== null && body.clientToken !== "") {
    if (typeof body.clientToken === "string" && TOKEN_PATTERN.test(body.clientToken)) clientToken = body.clientToken;
    else errors.clientToken = "Invalid submission id.";
  }

  if (Object.keys(errors).length) return { ok: false, errors };

  // Everything is valid: build the normalized record.
  const inPerson = V.isInPerson(data);
  const shepherd = V.needsShepherd(data)
    ? {
        fullName: data.participation.shepherd.name,
        email: data.participation.shepherd.email,
        phone: V.normalizePhone(data.participation.shepherd.phone),
        consentConfirmed: data.participation.shepherd.consent,
      }
    : null;

  const members = [
    {
      fullName: data.leader.name,
      email: data.leader.email,
      phone: V.normalizePhone(data.leader.phone),
      ageGroup: data.leader.ageGroup,
      organization: data.leader.organization,
    },
  ].concat(
    V.activeMembers(data).map((m) => ({
      fullName: m.name,
      email: m.email,
      phone: "",
      ageGroup: m.ageGroup,
      organization: "",
    }))
  );

  return {
    ok: true,
    record: {
      clientToken,
      teamName: data.team.name,
      teamSize: size,
      participationType: V.participationType(data),
      transportRequested: inPerson ? data.participation.transport : false,
      shepherd,
      skills: data.extra.skills,
      heardFrom: data.extra.heardFrom,
      notes: data.extra.notes,
      officialRegistrationConfirmed: data.team.officialConfirm,
      agreedAccurate: data.extra.agreeAccurate,
      agreedContact: data.extra.agreeContact,
      members,
    },
  };
}

module.exports = { parseRegistration };
