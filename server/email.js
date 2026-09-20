/* ==========================================================================
   server/email.js
   Sends the "new team registered" notification to the admin using nodemailer.

   Configured only through environment variables (see .env.example):
     EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD, ADMIN_EMAIL
   Optional: EMAIL_FROM (defaults to EMAIL_USER), EMAIL_SECURE ("true" forces TLS
   on connect; it is switched on automatically for port 465).

   Sending never blocks or breaks a registration: the team is already saved
   when this runs, and any failure is only logged.
   The message contains team details only, never a password or session data.
   ========================================================================== */
"use strict";

const PARTICIPATION_LABELS = {
  "in-person": "In-Person (Madaba, Jordan)",
  online: "Online (from anywhere in the world)",
};

const REQUIRED = ["EMAIL_HOST", "EMAIL_PORT", "EMAIL_USER", "EMAIL_PASSWORD", "ADMIN_EMAIL"];

/** Names of required settings that are empty. */
function missingSettings() {
  return REQUIRED.filter((name) => !String(process.env[name] || "").trim());
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Amman" }) + " (Jordan time)";
  } catch (error) {
    return String(iso);
  }
}

/** Builds { subject, text, html } for a saved team (the object returned by database.getTeam). */
function buildMessage(team) {
  const participation = PARTICIPATION_LABELS[team.participationType] || team.participationType;
  const leader = team.leader;
  const teamId = "#" + String(team.id).padStart(3, "0");

  const memberLines = team.members.map((m, i) => {
    const role = m.role === "leader" ? " (team leader)" : "";
    return (i + 1) + ". " + m.fullName + role + " <" + m.email + ">";
  });

  const subject = "New NASA Space Apps Madaba 2026 Team Registration";

  const text = [
    "A new team has registered for NASA Space Apps Challenge Madaba 2026.",
    "",
    "Team:",
    team.teamName + " (" + teamId + ")",
    "",
    "Team Size:",
    String(team.teamSize),
    "",
    "Participation:",
    participation,
    "",
    "Team Leader:",
    leader ? leader.fullName + " <" + leader.email + ">" : "-",
    "",
    "Members:",
    memberLines.join("\n"),
    "",
    "Registration Time:",
    formatTime(team.createdAt),
  ].join("\n");

  const row = (label, value) =>
    "<tr><td style=\"padding:6px 16px 6px 0;color:#555;vertical-align:top\"><strong>" + escapeHtml(label) +
    "</strong></td><td style=\"padding:6px 0\">" + value + "</td></tr>";

  const html =
    "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#111\">" +
    "<p>A new team has registered for <strong>NASA Space Apps Challenge Madaba 2026</strong>.</p>" +
    "<table style=\"border-collapse:collapse\">" +
    row("Team", escapeHtml(team.teamName) + " (" + escapeHtml(teamId) + ")") +
    row("Team Size", escapeHtml(team.teamSize)) +
    row("Participation", escapeHtml(participation)) +
    row("Team Leader", leader ? escapeHtml(leader.fullName) + " &lt;" + escapeHtml(leader.email) + "&gt;" : "-") +
    row("Members", memberLines.map(escapeHtml).join("<br>")) +
    row("Registration Time", escapeHtml(formatTime(team.createdAt))) +
    "</table></div>";

  return { subject, text, html };
}

let transport = null;

function getTransport() {
  if (transport) return transport;
  const nodemailer = require("nodemailer"); // loaded lazily so the server can start without email set up
  const port = Number(process.env.EMAIL_PORT);
  transport = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port,
    secure: process.env.EMAIL_SECURE === "true" || port === 465,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
  });
  return transport;
}

/**
 * Emails the admin about a new team.
 * Resolves { sent: true } or { sent: false, reason }. Never throws.
 */
async function sendNewTeamNotification(team) {
  const missing = missingSettings();
  if (missing.length) {
    return { sent: false, reason: "Email is not configured (missing " + missing.join(", ") + ")." };
  }

  try {
    const message = buildMessage(team);
    await getTransport().sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return { sent: true };
  } catch (error) {
    transport = null; // rebuild the connection next time in case the settings changed
    return { sent: false, reason: error && error.message ? error.message : String(error) };
  }
}

module.exports = { sendNewTeamNotification, buildMessage, missingSettings };
