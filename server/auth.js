/* ==========================================================================
   server/auth.js
   Admin authentication:
     - Password hashing (scrypt from Node's crypto: salted, slow, memory-hard).
       The password is never stored; only its hash is.
     - Login sessions: a random id in an HTTP-only, SameSite=Strict cookie.
       Only a keyed hash (HMAC with SESSION_SECRET) of that id is stored in the
       database, so a leaked database cannot be used to log in.
     - A small rate limiter (used for login attempts and for registrations).
     - requireAdmin: the middleware that protects every admin API route.

   Print a hash for a new password with:
       node server/auth.js hash "your new password"
   ========================================================================== */
"use strict";

const crypto = require("node:crypto");
const { promisify } = require("node:util");
const db = require("./database");

const scrypt = promisify(crypto.scrypt);

const COOKIE_NAME = "saj_admin";
const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 hours

/* ---------------------------------------------------------------------------
   Password hashing
   Stored format:  scrypt:<N>:<r>:<p>:<salt hex>:<hash hex>
   The parameters are stored with the hash so they can be raised later.
   ------------------------------------------------------------------------- */
const SCRYPT = { N: 32768, r: 8, p: 1, keylen: 64 };

function scryptOptions(N, r, p) {
  return { N, r, p, maxmem: 128 * N * r * 2 };
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(String(password), salt, SCRYPT.keylen, scryptOptions(SCRYPT.N, SCRYPT.r, SCRYPT.p));
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("hex"), derived.toString("hex")].join(":");
}

async function verifyPassword(password, stored) {
  const parts = String(stored || "").split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (![N, r, p].every(Number.isInteger)) return false;

  const salt = Buffer.from(parts[4], "hex");
  const expected = Buffer.from(parts[5], "hex");
  if (!salt.length || !expected.length) return false;

  try {
    const actual = await scrypt(String(password), salt, expected.length, scryptOptions(N, r, p));
    return crypto.timingSafeEqual(actual, expected);
  } catch (error) {
    return false;
  }
}

/* ---------------------------------------------------------------------------
   Admin account setup (runs at every start; never removes anything)
   - Creates the admin from ADMIN_EMAIL + ADMIN_PASSWORD_HASH if it is missing.
   - If ADMIN_PASSWORD_HASH changed in .env, the stored hash is updated.
   - ADMIN_INITIAL_PASSWORD (optional) is hashed once, only when no account exists.
   ------------------------------------------------------------------------- */
async function ensureAdmin(log) {
  const say = log || console;
  const email = String(process.env.ADMIN_EMAIL || "").trim();
  if (!email) {
    say.warn("[auth] ADMIN_EMAIL is not set: no admin account was created.");
    return;
  }

  const existing = db.getAdminByEmail(email);
  let hash = String(process.env.ADMIN_PASSWORD_HASH || "").trim();

  if (!existing) {
    if (!hash && process.env.ADMIN_INITIAL_PASSWORD) hash = await hashPassword(process.env.ADMIN_INITIAL_PASSWORD);
    if (!hash) {
      say.warn("[auth] No ADMIN_PASSWORD_HASH set: the admin account was not created. See README.md.");
      return;
    }
    db.createAdmin(email, hash);
    say.log("[auth] Admin account created for " + email);
  } else if (hash && hash !== existing.password_hash) {
    db.updateAdminPassword(existing.id, hash);
    say.log("[auth] Admin password updated from ADMIN_PASSWORD_HASH for " + email);
  }
}

/* ---------------------------------------------------------------------------
   Login
   ------------------------------------------------------------------------- */
let dummyHashPromise = null;

/** Returns the admin row when email and password are right, otherwise null. */
async function authenticate(email, password) {
  const admin = typeof email === "string" ? db.getAdminByEmail(email) : null;
  // Always do the expensive hash check, even for unknown emails, so timing does not reveal which emails exist.
  if (!admin && !dummyHashPromise) dummyHashPromise = hashPassword(crypto.randomBytes(12).toString("hex"));
  const stored = admin ? admin.password_hash : await dummyHashPromise;
  const ok = await verifyPassword(typeof password === "string" ? password : "", stored);
  return ok && admin ? admin : null;
}

/* ---------------------------------------------------------------------------
   Sessions and cookies
   ------------------------------------------------------------------------- */
let warnedAboutSecret = false;
let fallbackSecret = null;

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (!fallbackSecret) fallbackSecret = crypto.randomBytes(32).toString("hex");
  if (!warnedAboutSecret) {
    warnedAboutSecret = true;
    console.warn("[auth] SESSION_SECRET is missing or too short. Using a temporary secret: admin logins will not survive a restart.");
  }
  return fallbackSecret;
}

function hashSessionId(sid) {
  return crypto.createHmac("sha256", sessionSecret()).update(String(sid)).digest("hex");
}

function parseCookies(header) {
  const out = {};
  String(header || "")
    .split(";")
    .forEach((part) => {
      const index = part.indexOf("=");
      if (index < 0) return;
      const name = part.slice(0, index).trim();
      if (!name) return;
      const raw = part.slice(index + 1).trim();
      try {
        out[name] = decodeURIComponent(raw);
      } catch (error) {
        out[name] = raw; // malformed escape sequence: keep the raw text, it will simply not match a session
      }
    });
  return out;
}

function cookieSecure() {
  return process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
}

function cookieString(value, maxAgeSeconds) {
  return [
    COOKIE_NAME + "=" + value,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=" + maxAgeSeconds,
    cookieSecure() ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

/** Creates a session for an admin and sets the cookie on the response. */
function startSession(res, admin) {
  db.purgeExpiredSessions();
  const sid = crypto.randomBytes(32).toString("base64url");
  db.createSession(hashSessionId(sid), admin.id, SESSION_TTL_SECONDS);
  res.setHeader("Set-Cookie", cookieString(sid, SESSION_TTL_SECONDS));
}

/** Deletes the session (if any) and clears the cookie. */
function endSession(req, res) {
  const sid = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (sid) db.deleteSession(hashSessionId(sid));
  res.setHeader("Set-Cookie", cookieString("", 0));
}

/** Looks up the admin behind the request's cookie, or null. */
function currentAdmin(req) {
  const sid = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (!sid || sid.length > 200) return null;
  return db.getSession(hashSessionId(sid));
}

/** Express middleware: 401 unless the request carries a valid admin session. */
function requireAdmin(req, res, next) {
  const admin = currentAdmin(req);
  if (!admin) return res.status(401).json({ ok: false, message: "Not signed in." });
  req.admin = admin;
  return next();
}

/* ---------------------------------------------------------------------------
   Rate limiter (in memory, per key such as an IP address)
   ------------------------------------------------------------------------- */
function createRateLimiter(max, windowMs) {
  const hits = new Map();

  const timer = setInterval(() => {
    const cutoff = Date.now();
    hits.forEach((entry, key) => {
      if (entry.resetAt <= cutoff) hits.delete(key);
    });
  }, Math.min(windowMs, 60 * 1000));
  if (timer.unref) timer.unref();

  return {
    /** Counts one attempt. Returns { allowed, retryAfterSeconds }. */
    consume(key) {
      const time = Date.now();
      let entry = hits.get(key);
      if (!entry || entry.resetAt <= time) {
        entry = { count: 0, resetAt: time + windowMs };
        hits.set(key, entry);
      }
      entry.count += 1;
      return { allowed: entry.count <= max, retryAfterSeconds: Math.ceil((entry.resetAt - time) / 1000) };
    },
    reset(key) {
      hits.delete(key);
    },
  };
}

module.exports = {
  COOKIE_NAME,
  hashPassword,
  verifyPassword,
  ensureAdmin,
  authenticate,
  startSession,
  endSession,
  currentAdmin,
  requireAdmin,
  createRateLimiter,
  parseCookies,
};

/* Command line helper:  node server/auth.js hash "password"  ->  prints the hash for ADMIN_PASSWORD_HASH */
if (require.main === module) {
  const [command, password] = process.argv.slice(2);
  if (command === "hash" && password) {
    hashPassword(password).then((hash) => console.log(hash));
  } else {
    console.log('Usage: node server/auth.js hash "your password"');
  }
}
