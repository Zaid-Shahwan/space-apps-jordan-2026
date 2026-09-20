/* ==========================================================================
   server/database.js
   Everything that touches SQLite lives here: opening the database, creating
   the tables on first start, and every query the rest of the server needs.

   Uses Node's built-in `node:sqlite` module (Node 22.13 or newer), so there is
   no native package to compile. The database file is created automatically in
   database/space_apps.db and is NEVER reset or deleted by the server: tables
   are created with IF NOT EXISTS and existing rows are left alone.

   Tables
     teams         one row per registered team
     team_members  one row per person (the leader is position 1), linked to teams
     admins        admin accounts (password stored as a hash, never plain text)
     sessions      admin login sessions (only a keyed hash of the cookie value)
   ========================================================================== */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const DEFAULT_DB_PATH = path.join(__dirname, "..", "database", "space_apps.db");
const SCHEMA_VERSION = 1;

let db = null;

/* ---------------------------------------------------------------------------
   Opening and schema
   ------------------------------------------------------------------------- */
function open(dbPath) {
  if (db) return db;
  const file = path.resolve(dbPath || process.env.DATABASE_PATH || DEFAULT_DB_PATH);
  fs.mkdirSync(path.dirname(file), { recursive: true });

  db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON;"); // enforce team_members.team_id -> teams.id
  db.exec("PRAGMA journal_mode = WAL;"); // safer, faster writes
  migrate();
  return db;
}

function close() {
  if (db) db.close();
  db = null;
}

/** Creates missing tables. Uses PRAGMA user_version so later migrations can be added safely. */
function migrate() {
  const current = db.prepare("PRAGMA user_version").get().user_version;

  if (current < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS teams (
        id                    INTEGER PRIMARY KEY AUTOINCREMENT,
        client_token          TEXT UNIQUE,
        team_name             TEXT NOT NULL,
        team_size             INTEGER NOT NULL CHECK (team_size BETWEEN 1 AND 6),
        participation_type    TEXT NOT NULL CHECK (participation_type IN ('in-person', 'online')),
        transport_requested   INTEGER NOT NULL DEFAULT 0,
        shepherd_name         TEXT,
        shepherd_email        TEXT,
        shepherd_phone        TEXT,
        shepherd_consent      INTEGER NOT NULL DEFAULT 0,
        skills                TEXT NOT NULL DEFAULT '[]',
        heard_from            TEXT,
        notes                 TEXT,
        official_registration_confirmed INTEGER NOT NULL DEFAULT 0,
        agreed_accurate       INTEGER NOT NULL DEFAULT 0,
        agreed_contact        INTEGER NOT NULL DEFAULT 0,
        created_at            TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS team_members (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        team_id       INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        position      INTEGER NOT NULL CHECK (position BETWEEN 1 AND 6),
        role          TEXT NOT NULL CHECK (role IN ('leader', 'member')),
        full_name     TEXT NOT NULL,
        email         TEXT NOT NULL,
        phone         TEXT,
        age_group     TEXT,
        organization  TEXT,
        created_at    TEXT NOT NULL,
        UNIQUE (team_id, position)
      );

      CREATE TABLE IF NOT EXISTS admins (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash  TEXT NOT NULL,
        created_at     TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id_hash     TEXT PRIMARY KEY,
        admin_id    INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
        created_at  TEXT NOT NULL,
        expires_at  TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
      CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email COLLATE NOCASE);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    `);
    db.exec("PRAGMA user_version = " + SCHEMA_VERSION);
  }
  // Future schema changes: add `if (current < 2) { ...ALTER TABLE...; PRAGMA user_version = 2 }`.
}

function conn() {
  return db || open();
}

const now = () => new Date().toISOString();
const flag = (value) => (value ? 1 : 0);

/* ---------------------------------------------------------------------------
   Mapping rows to plain objects
   ------------------------------------------------------------------------- */
function mapMember(row) {
  return {
    id: row.id,
    position: row.position,
    role: row.role,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone || "",
    ageGroup: row.age_group || "",
    organization: row.organization || "",
  };
}

function parseSkills(text) {
  try {
    const list = JSON.parse(text);
    return Array.isArray(list) ? list : [];
  } catch (error) {
    return [];
  }
}

function mapTeam(row, memberRows) {
  const members = memberRows.map(mapMember);
  return {
    id: row.id,
    teamName: row.team_name,
    teamSize: row.team_size,
    participationType: row.participation_type,
    transportRequested: row.transport_requested === 1,
    shepherd: row.shepherd_name
      ? {
          fullName: row.shepherd_name,
          email: row.shepherd_email || "",
          phone: row.shepherd_phone || "",
          consentConfirmed: row.shepherd_consent === 1,
        }
      : null,
    skills: parseSkills(row.skills),
    heardFrom: row.heard_from || "",
    notes: row.notes || "",
    officialRegistrationConfirmed: row.official_registration_confirmed === 1,
    agreedAccurate: row.agreed_accurate === 1,
    agreedContact: row.agreed_contact === 1,
    createdAt: row.created_at,
    leader: members.find((m) => m.role === "leader") || null,
    members, // everyone, leader first
  };
}

/** Loads the members of several teams with a few IN (...) queries instead of one per team. */
function membersByTeam(teamIds) {
  const map = new Map();
  teamIds.forEach((id) => map.set(id, []));
  const CHUNK = 500;
  for (let i = 0; i < teamIds.length; i += CHUNK) {
    const ids = teamIds.slice(i, i + CHUNK);
    const marks = ids.map(() => "?").join(",");
    const rows = conn()
      .prepare(`SELECT * FROM team_members WHERE team_id IN (${marks}) ORDER BY team_id, position`)
      .all(...ids);
    rows.forEach((row) => map.get(row.team_id).push(row));
  }
  return map;
}

/* ---------------------------------------------------------------------------
   Teams
   ------------------------------------------------------------------------- */

/**
 * Saves a team and all of its members in ONE transaction: either everything is
 * stored or nothing is. `record` comes from server/registration.js (already validated).
 */
function insertTeam(record) {
  const d = conn();
  if (record.members.length !== record.teamSize) {
    throw new Error("Member count does not match team size");
  }
  const created = now();

  d.exec("BEGIN IMMEDIATE");
  try {
    const info = d
      .prepare(
        `INSERT INTO teams (
           client_token, team_name, team_size, participation_type, transport_requested,
           shepherd_name, shepherd_email, shepherd_phone, shepherd_consent,
           skills, heard_from, notes,
           official_registration_confirmed, agreed_accurate, agreed_contact, created_at
         ) VALUES (?,?,?,?,?, ?,?,?,?, ?,?,?, ?,?,?,?)`
      )
      .run(
        record.clientToken || null,
        record.teamName,
        record.teamSize,
        record.participationType,
        flag(record.transportRequested),
        record.shepherd ? record.shepherd.fullName : null,
        record.shepherd ? record.shepherd.email : null,
        record.shepherd ? record.shepherd.phone : null,
        record.shepherd ? flag(record.shepherd.consentConfirmed) : 0,
        JSON.stringify(record.skills || []),
        record.heardFrom || null,
        record.notes || null,
        flag(record.officialRegistrationConfirmed),
        flag(record.agreedAccurate),
        flag(record.agreedContact),
        created
      );
    const teamId = Number(info.lastInsertRowid);

    const insertMember = d.prepare(
      `INSERT INTO team_members (team_id, position, role, full_name, email, phone, age_group, organization, created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`
    );
    record.members.forEach((m, index) => {
      insertMember.run(
        teamId,
        index + 1,
        index === 0 ? "leader" : "member",
        m.fullName,
        m.email,
        m.phone || null,
        m.ageGroup || null,
        m.organization || null,
        created
      );
    });

    d.exec("COMMIT");
    return getTeam(teamId);
  } catch (error) {
    try {
      d.exec("ROLLBACK");
    } catch (rollbackError) {
      /* nothing left to roll back */
    }
    throw error;
  }
}

function getTeam(id) {
  const row = conn().prepare("SELECT * FROM teams WHERE id = ?").get(id);
  if (!row) return null;
  const members = conn().prepare("SELECT * FROM team_members WHERE team_id = ? ORDER BY position").all(id);
  return mapTeam(row, members);
}

/** Same submission sent twice (double click, or a retry after a lost response). */
function findTeamByToken(token) {
  if (!token) return null;
  const row = conn().prepare("SELECT id FROM teams WHERE client_token = ?").get(token);
  return row ? getTeam(row.id) : null;
}

/** Same team name and same leader email (case-insensitive) means an accidental duplicate. */
function findDuplicateTeam(teamName, leaderEmail) {
  const row = conn()
    .prepare(
      `SELECT t.id FROM teams t
       JOIN team_members m ON m.team_id = t.id AND m.position = 1
       WHERE lower(t.team_name) = lower(?) AND lower(m.email) = lower(?)
       LIMIT 1`
    )
    .get(teamName, leaderEmail);
  return row ? getTeam(row.id) : null;
}

const LIST_LIMIT = 1000;

/**
 * Lists teams (newest first) with all their members. An optional search term
 * matches team name, member name, member email, or team id ("12" or "#012").
 */
function searchTeams(term) {
  const d = conn();
  const query = String(term || "").trim().slice(0, 100);
  let rows;

  if (!query) {
    rows = d.prepare("SELECT * FROM teams ORDER BY id DESC LIMIT ?").all(LIST_LIMIT);
  } else {
    // Escape LIKE wildcards so "50%" or "a_b" are searched literally.
    const like = "%" + query.replace(/[\\%_]/g, (c) => "\\" + c) + "%";
    const idText = query.replace(/^#/, "");
    const idMatch = /^\d{1,9}$/.test(idText) ? Number(idText) : -1;
    rows = d
      .prepare(
        `SELECT DISTINCT t.* FROM teams t
         LEFT JOIN team_members m ON m.team_id = t.id
         WHERE t.id = ?
            OR t.team_name LIKE ? ESCAPE '\\'
            OR m.full_name LIKE ? ESCAPE '\\'
            OR m.email LIKE ? ESCAPE '\\'
         ORDER BY t.id DESC LIMIT ?`
      )
      .all(idMatch, like, like, like, LIST_LIMIT);
  }

  const byTeam = membersByTeam(rows.map((r) => r.id));
  return rows.map((row) => mapTeam(row, byTeam.get(row.id)));
}

/** Totals across ALL registrations (not affected by the search filter). */
function summary() {
  const row = conn()
    .prepare(
      `SELECT COUNT(*) AS teams,
              COALESCE(SUM(team_size), 0) AS participants,
              COALESCE(SUM(participation_type = 'in-person'), 0) AS in_person,
              COALESCE(SUM(participation_type = 'online'), 0) AS online
       FROM teams`
    )
    .get();
  return {
    teams: row.teams,
    participants: row.participants,
    inPersonTeams: row.in_person,
    onlineTeams: row.online,
  };
}

/* ---------------------------------------------------------------------------
   Admins and sessions
   ------------------------------------------------------------------------- */
function getAdminByEmail(email) {
  return conn().prepare("SELECT * FROM admins WHERE email = ?").get(String(email || "").trim()) || null;
}

function createAdmin(email, passwordHash) {
  conn().prepare("INSERT INTO admins (email, password_hash, created_at) VALUES (?,?,?)").run(email, passwordHash, now());
}

function updateAdminPassword(id, passwordHash) {
  conn().prepare("UPDATE admins SET password_hash = ? WHERE id = ?").run(passwordHash, id);
}

function createSession(idHash, adminId, ttlSeconds) {
  const created = new Date();
  const expires = new Date(created.getTime() + ttlSeconds * 1000);
  conn()
    .prepare("INSERT INTO sessions (id_hash, admin_id, created_at, expires_at) VALUES (?,?,?,?)")
    .run(idHash, adminId, created.toISOString(), expires.toISOString());
}

/** Returns { adminId, email } for a live session, otherwise null. */
function getSession(idHash) {
  const row = conn()
    .prepare(
      `SELECT s.admin_id AS adminId, a.email AS email
       FROM sessions s JOIN admins a ON a.id = s.admin_id
       WHERE s.id_hash = ? AND s.expires_at > ?`
    )
    .get(idHash, now());
  return row ? { adminId: row.adminId, email: row.email } : null;
}

function deleteSession(idHash) {
  conn().prepare("DELETE FROM sessions WHERE id_hash = ?").run(idHash);
}

function purgeExpiredSessions() {
  conn().prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now());
}

module.exports = {
  open,
  close,
  insertTeam,
  getTeam,
  findTeamByToken,
  findDuplicateTeam,
  searchTeams,
  summary,
  getAdminByEmail,
  createAdmin,
  updateAdminPassword,
  createSession,
  getSession,
  deleteSession,
  purgeExpiredSessions,
};
