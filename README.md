# NASA Space Apps Challenge, Madaba 2026

Registration website for **NASA Space Apps Challenge Madaba, Jordan 2026**: in person in Madaba
or online from anywhere in the world, teams of 1 to 6 people.

- **Frontend:** plain HTML, CSS and vanilla JavaScript (in `public/`).
- **Backend:** Node.js + Express, serving the website and a JSON API.
- **Database:** SQLite (`database/space_apps.db`, created automatically).
- **Admin dashboard:** `/admin.html`, protected by a login that the server enforces.
- **Email:** the admin is emailed whenever a new team registers.

The Express server serves the frontend itself, so **you do not need VS Code Live Server** (port 5500)
and there is no CORS to configure. Registration and the admin area only work while the server is running.

## Run it in VS Code

You need **Node.js 22.13 or newer** (`node -v` shows your version). Download it from nodejs.org if needed.

1. Open this folder in VS Code (**File > Open Folder...**).
2. Open a terminal (**Terminal > New Terminal**) and run:

   ```
   npm install
   ```

3. Check the `.env` file (already created for you, see "Configuration" below). To receive emails,
   fill in the `EMAIL_*` values.
4. Start the server:

   ```
   npm start
   ```

5. Open <http://localhost:3000>. Useful pages:

   | Page | URL |
   | --- | --- |
   | Home | <http://localhost:3000/> |
   | Registration | <http://localhost:3000/register.html> |
   | Admin dashboard | <http://localhost:3000/admin.html> |

For development, `npm run dev` restarts the server when server files change.
Stop the server with `Ctrl+C`.

## Configuration (`.env`)

`.env` lives in the project root, next to `package.json`. It is **not** inside `public/`, so the browser can
never download it, and `.gitignore` keeps it out of Git. `.env.example` shows every setting.

| Setting | Meaning |
| --- | --- |
| `PORT` | Port to run on (default 3000) |
| `ADMIN_EMAIL` | Admin login email **and** the address that receives new-registration emails |
| `ADMIN_PASSWORD_HASH` | Hash of the admin password (never the password itself) |
| `SESSION_SECRET` | Random secret protecting admin sessions (already generated for you) |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD` | SMTP account used to send the notification |
| `EMAIL_FROM` | Optional "From" address (defaults to `EMAIL_USER`) |
| `COOKIE_SECURE=true`, `TRUST_PROXY=true` | Set both when hosting behind HTTPS / a reverse proxy |

### Email notifications

Registration emails use `nodemailer`. Fill in the four `EMAIL_*` values with an SMTP account.
For **Gmail**: turn on 2-Step Verification, create an **App Password** (Google Account > Security > App passwords), then use

```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_USER=your.address@gmail.com
EMAIL_PASSWORD=<the 16-character app password>
```

If the email settings are empty, registrations are still saved and the terminal prints
`[email] Not configured ...`. If sending fails (wrong password, no internet), the registration is still
saved and the terminal prints the reason. Look at the terminal if emails do not arrive.
The email lists the team, size, participation type, leader, members and time. It never contains passwords.

### Admin login

- **Email:** the `ADMIN_EMAIL` value (`karamne99@gmail.com`).
- **Password:** the one you were given. It is **not stored anywhere in this project**: only its
  scrypt hash is (in `.env`, and then in the database).

To change the password:

```
npm run hash-password -- "your new password"
```

Copy the printed line into `ADMIN_PASSWORD_HASH` in `.env` and restart. Do this before the site is
public, because the current password has been shared in plain text.

## How it works

```
Browser  --fetch-->  Express (server/server.js)  -->  SQLite (database/space_apps.db)
   public/*.html, css, js         |                          teams, team_members, admins, sessions
                                  +--> nodemailer  -->  email to ADMIN_EMAIL
```

### Project structure

```
space-apps-jordan-2026/
├── public/                    Everything the browser may load (the only folder Express serves)
│   ├── index.html, register.html, event.html, about.html, 2025.html, help.html
│   ├── admin.html             Admin login + dashboard (no link to it anywhere on the site)
│   ├── css/style.css          Shared design (tokens, components, form, space background)
│   ├── css/responsive.css     Shared breakpoints
│   ├── css/admin.css          Admin page only
│   ├── js/config.js           Team limits, dates, links. Also used by the server.
│   ├── js/layout.js           Shared header, footer and icons
│   ├── js/main.js             Navigation, countdown, reveal animations
│   ├── js/storage.js          localStorage for the in-progress form draft
│   ├── js/validation.js       Validation rules. Used by the form AND by the server.
│   ├── js/submission.js       Builds the request and calls /api/register
│   ├── js/form.js             Registration form: steps, team size, members, review, success
│   ├── js/admin.js            Admin page: login, teams, search, logout
│   └── assets/                icons, images (og-image, galaxy-1/2, space-stars), fonts
├── server/
│   ├── server.js              Express app, routes, startup
│   ├── database.js            SQLite: tables and every query
│   ├── registration.js        Server-side validation of a registration
│   ├── auth.js                Password hashing, sessions, rate limiting
│   └── email.js               Notification email (nodemailer)
├── database/space_apps.db     Created on first start; never reset by the server
├── .env / .env.example
├── package.json
└── README.md
```

### API

| Method and path | Access | Purpose |
| --- | --- | --- |
| `POST /api/register` | public | Validate and save a team, then email the admin |
| `POST /api/admin/login` | public | Body `{ email, password }`; sets the session cookie |
| `POST /api/admin/logout` | public | Ends the session |
| `GET /api/admin/me` | public | `{ signedIn: true/false }` |
| `GET /api/teams?q=` | **admin only** | All teams with all members; `q` searches team name, member name, member email or team ID |
| `GET /api/teams/:id` | **admin only** | One team |

### Database

Created automatically on the first start (`PRAGMA user_version` tracks the schema, so future changes can be
added as migrations). Existing data is never deleted or reset.

| Table | Contents |
| --- | --- |
| `teams` | id, team name, team size (1-6), participation type (`in-person` / `online`), transport request, adult shepherd details, skills, notes, agreements, created time |
| `team_members` | One row per person: `team_id` (foreign key to `teams.id`), position (1 = leader), role, name, email, phone (leader), age group, organization |
| `admins` | email, `password_hash` |
| `sessions` | keyed hash of the session cookie, admin id, expiry |

To back up the registrations, stop the server and copy `database/space_apps.db` (and the `-wal`/`-shm` files
next to it if present). Open it with any SQLite viewer (for example the "SQLite Viewer" VS Code extension).

### Rules enforced

- **Team size 1 to 6.** The form shows the leader plus `size - 1` member cards. The server rejects 0, 7, non-numbers
  and any request whose member count is not exactly `size - 1`.
- **The server never trusts the browser.** `server/registration.js` re-validates every field with the same rules the form
  uses (`public/js/validation.js`), plus type, length and allowed-value checks.
- **Participation:** in person (Madaba, Jordan) or online (anywhere in the world). A participant under 18 attending
  in person needs a separate adult shepherd and a consent confirmation.
- **Double submissions:** the button is disabled while sending, every attempt carries a one-time id so a repeated
  request returns the already-saved team, and a second team with the same name and leader email is refused.

### Security notes

- Admin data is protected **on the server**: `/api/teams` answers `401` without a valid session.
- Password: scrypt with a random salt (Node's built-in `crypto`); compared in constant time.
- Session cookie: random id, `HttpOnly`, `SameSite=Strict` (and `Secure` over HTTPS). The database stores only an
  HMAC of it. Sessions last 8 hours and end on logout.
- Login is limited to 5 attempts per 15 minutes per IP; registration to 60 per hour per IP.
- Only `public/` is served: `server/`, `database/`, `.env` and `package.json` are not reachable from the browser.
- Cross-site POST requests are rejected, and API responses are sent with `Cache-Control: no-store`.
- Before going live: use HTTPS, set `COOKIE_SECURE=true`, change the admin password, and keep `.env` private.

## Putting it online (so anyone can register)

The site must run on a server that stays on. Any host that runs Node.js 22.13+ works (Render, Railway, Fly.io, a VPS).

1. Put the project on GitHub (`.env` and the database are already excluded by `.gitignore`).
2. Create a web service from the repository. Build command: `npm install`. Start command: `npm start`.
3. Set these environment variables in the host's dashboard (do not upload `.env`):
   `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`,
   `COOKIE_SECURE=true`, `TRUST_PROXY=true`, `NODE_ENV=production` and `DATABASE_PATH`.
4. **Attach a persistent disk/volume** and point `DATABASE_PATH` at it (for example `/var/data/space_apps.db`).
   Without one, most hosts wipe the filesystem on every restart or deploy and **all registrations would be lost**.
5. Change the admin password first: `npm run hash-password -- "new password"` and use that hash.

## Things to check before publishing

These were carried over from the earlier Amman & Aqaba version or assumed. Please confirm them:

- **Dates:** the site still says **13-14 November 2026** (`public/js/config.js`, plus the pages).
- **Venue:** only "Madaba, Jordan" is stated. No venue or address was given, so none is shown.
- **Rules kept from the earlier version:** no overnight accommodation, limited transportation coverage (now worded
  "traveling to Madaba"), and the under-18 consent and adult shepherd rule. Change them if Madaba differs.
- **Local leads removed:** the About page's "Local leadership" section named the Amman and Aqaba leads, so it was
  removed. Add the Madaba leads back when you have them.
- **2025 pages** still describe the Amman 2025 edition, because that is history.
- **Fonts:** Unbounded and Manrope load from Google Fonts (needs internet); offline the site uses system fonts.

## Testing notes

The database, authentication, registration validation, email composition, and the full browser flow (register teams of
1 to 6, admin login, search, logout) were tested against the code in this project. The environment used for that
could not install npm packages, so Express and nodemailer were replaced by small stand-ins during those tests.
Your first `npm install && npm start` is therefore the first run on the real packages. If anything does not start,
copy the terminal message and it can be fixed quickly.
