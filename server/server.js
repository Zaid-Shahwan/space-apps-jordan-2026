/* ==========================================================================
   server/server.js
   The Express app. It does three things:
     1. serves the website from public/ (so there is no CORS to configure)
     2. exposes the JSON API under /api
     3. starts listening

   Public API
     POST /api/register           register a team (saved in SQLite, admin emailed)
   Admin API (needs the admin session cookie, enforced here on the server)
     POST /api/admin/login        { email, password }
     POST /api/admin/logout
     GET  /api/admin/me           who is signed in
     GET  /api/teams?q=term       list / search teams (with all members)
     GET  /api/teams/:id          one team

   Start it with `npm start` and open http://localhost:3000
   ========================================================================== */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

/* Load .env (if present) into process.env. Real environment variables win over the file. */
const ENV_FILE = path.join(__dirname, "..", ".env");
if (fs.existsSync(ENV_FILE)) {
  try {
    process.loadEnvFile(ENV_FILE);
  } catch (error) {
    console.warn("[server] Could not read .env: " + error.message);
  }
}

const express = require("express");
const db = require("./database");
const auth = require("./auth");
const email = require("./email");
const { parseRegistration } = require("./registration");

const PUBLIC_DIR = path.join(__dirname, "..", "public");

const app = express();
app.disable("x-powered-by");
// Behind a reverse proxy (HTTPS on a real host) set TRUST_PROXY=true so client IPs are read correctly.
if (process.env.TRUST_PROXY === "true") app.set("trust proxy", 1);

/* ---------------------------------------------------------------------------
   Middleware
   ------------------------------------------------------------------------- */
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

/** API responses (admin data especially) must never be cached by the browser or a proxy. */
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.use(express.json({ limit: "50kb" }));

/** State-changing API calls must come from this same site (defence in depth next to SameSite=Strict cookies). */
app.use("/api", (req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD") return next();
  const origin = req.headers.origin;
  if (origin) {
    let host = "";
    try {
      host = new URL(origin).host;
    } catch (error) {
      host = "";
    }
    // Behind a proxy or tunnel the public host name arrives in X-Forwarded-Host (only trusted with TRUST_PROXY=true).
    const forwarded = process.env.TRUST_PROXY === "true" ? String(req.headers["x-forwarded-host"] || "").split(",")[0].trim() : "";
    if (host !== (forwarded || req.headers.host)) return res.status(403).json({ ok: false, message: "Cross-site requests are not allowed." });
  }
  return next();
});

const loginLimiter = auth.createRateLimiter(5, 15 * 60 * 1000); // 5 login attempts / 15 min / IP
const registerLimiter = auth.createRateLimiter(60, 60 * 60 * 1000); // 60 registrations / hour / IP

function clientKey(req) {
  return req.ip || (req.socket && req.socket.remoteAddress) || "unknown";
}

/* ---------------------------------------------------------------------------
   Public: register a team
   ------------------------------------------------------------------------- */

/** Only what the confirmation screen needs. No personal data is sent back. */
function publicTeam(team) {
  return { id: team.id, teamName: team.teamName, teamSize: team.teamSize, participationType: team.participationType };
}

app.post("/api/register", (req, res) => {
  try {
    const limit = registerLimiter.consume(clientKey(req));
    if (!limit.allowed) {
      res.setHeader("Retry-After", String(limit.retryAfterSeconds));
      return res.status(429).json({ ok: false, message: "Too many registrations from this connection. Please try again later." });
    }

    // 1. Never trust the browser: validate everything again.
    const parsed = parseRegistration(req.body);
    if (!parsed.ok) return res.status(422).json({ ok: false, errors: parsed.errors });
    const record = parsed.record;

    // 2. Same submission twice (double click, or a retry after a lost response): return the saved team.
    const same = db.findTeamByToken(record.clientToken);
    if (same) return res.status(200).json({ ok: true, alreadySubmitted: true, team: publicTeam(same) });

    // 3. Same team name + same leader email: an accidental duplicate.
    if (db.findDuplicateTeam(record.teamName, record.members[0].email)) {
      return res.status(409).json({
        ok: false,
        code: "duplicate",
        message: "A team with this name and leader email is already registered.",
      });
    }

    // 4. Save the team and every member in one transaction.
    const team = db.insertTeam(record);

    // 5. Tell the admin. Runs in the background; a failure never affects the registration.
    email
      .sendNewTeamNotification(team)
      .then((result) => {
        if (result.sent) console.log("[email] Notification sent for team #" + team.id);
        else console.warn("[email] Notification NOT sent for team #" + team.id + ": " + result.reason);
      })
      .catch((error) => console.warn("[email] Unexpected error: " + error.message));

    return res.status(201).json({ ok: true, team: publicTeam(team) });
  } catch (error) {
    console.error("[register] " + (error && error.stack ? error.stack : error));
    return res.status(500).json({ ok: false, message: "Something went wrong while saving the registration." });
  }
});

/* ---------------------------------------------------------------------------
   Admin: login, logout, session check
   ------------------------------------------------------------------------- */
app.post("/api/admin/login", async (req, res) => {
  try {
    const key = clientKey(req);
    const limit = loginLimiter.consume(key);
    if (!limit.allowed) {
      res.setHeader("Retry-After", String(limit.retryAfterSeconds));
      return res.status(429).json({ ok: false, message: "Too many sign-in attempts. Please wait a few minutes and try again." });
    }

    const body = req.body || {};
    const admin = await auth.authenticate(body.email, body.password);
    if (!admin) return res.status(401).json({ ok: false, message: "Invalid email or password." });

    loginLimiter.reset(key);
    auth.startSession(res, admin);
    return res.json({ ok: true, admin: { email: admin.email } });
  } catch (error) {
    console.error("[login] " + (error && error.stack ? error.stack : error));
    return res.status(500).json({ ok: false, message: "Something went wrong." });
  }
});

app.post("/api/admin/logout", (req, res) => {
  try {
    auth.endSession(req, res);
    return res.json({ ok: true });
  } catch (error) {
    console.error("[logout] " + error.message);
    return res.status(500).json({ ok: false, message: "Something went wrong." });
  }
});

/** "Am I signed in?" Answers 200 either way so the admin page can check quietly; it exposes nothing but the email. */
app.get("/api/admin/me", (req, res) => {
  const admin = auth.currentAdmin(req);
  if (!admin) return res.json({ ok: true, signedIn: false });
  return res.json({ ok: true, signedIn: true, admin: { email: admin.email } });
});

/* ---------------------------------------------------------------------------
   Admin: registered teams (every route below needs a valid admin session)
   ------------------------------------------------------------------------- */
app.get("/api/teams", auth.requireAdmin, (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    return res.json({ ok: true, teams: db.searchTeams(q), summary: db.summary() });
  } catch (error) {
    console.error("[teams] " + error.message);
    return res.status(500).json({ ok: false, message: "Could not load the teams." });
  }
});

app.get("/api/teams/:id", auth.requireAdmin, (req, res) => {
  try {
    if (!/^\d{1,9}$/.test(String(req.params.id))) return res.status(404).json({ ok: false, message: "Team not found." });
    const team = db.getTeam(Number(req.params.id));
    if (!team) return res.status(404).json({ ok: false, message: "Team not found." });
    return res.json({ ok: true, team });
  } catch (error) {
    console.error("[team] " + error.message);
    return res.status(500).json({ ok: false, message: "Could not load the team." });
  }
});

app.use("/api", (req, res) => res.status(404).json({ ok: false, message: "Not found." }));

/* ---------------------------------------------------------------------------
   The website itself (only public/ is served, never server/, database/ or .env)
   ------------------------------------------------------------------------- */
app.use(express.static(PUBLIC_DIR));

/* Errors: bad JSON, oversized bodies, anything unexpected. */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.type === "entity.parse.failed") return res.status(400).json({ ok: false, message: "The request body is not valid JSON." });
  if (err && err.type === "entity.too.large") return res.status(413).json({ ok: false, message: "The request is too large." });
  console.error("[server] " + (err && err.stack ? err.stack : err));
  return res.status(500).json({ ok: false, message: "Something went wrong." });
});

/* ---------------------------------------------------------------------------
   Startup
   ------------------------------------------------------------------------- */
async function start() {
  db.open(); // creates database/space_apps.db and the tables on first run
  await auth.ensureAdmin();

  if (email.missingSettings().length) {
    console.warn("[email] Not configured (missing " + email.missingSettings().join(", ") + "). Registrations will be saved, but no notification email is sent.");
  }

  const port = Number(process.env.PORT) || 3000;
  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log("NASA Space Apps Madaba 2026 is running at http://localhost:" + port);
      console.log("  Registration page: http://localhost:" + port + "/register.html");
      resolve(server);
    });
  });
}

module.exports = { app, start };

if (require.main === module) {
  start().catch((error) => {
    console.error("Could not start the server: " + (error && error.stack ? error.stack : error));
    process.exit(1);
  });
}
