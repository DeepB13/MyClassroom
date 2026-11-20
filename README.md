# MY CLASSROOM — MERN edition

The Flask classroom manager rebuilt on **MongoDB + Express + React + Node**.
Same features, same screens, same CSS (copied unchanged), same permission rules.

## Run it

Requires Node 18+ and a MongoDB server (local, or an Atlas connection string).

```bash
npm run install:all                 # installs root, server and client dependencies
cp server/.env.example server/.env  # edit MONGO_URI if MongoDB isn't on localhost
npm run dev                         # API on :5000, React (Vite) on :5173  ->  open http://localhost:5173
```

Production: `npm run build && npm start` — Express serves the built React app and the API together on :5000.
Set `SECRET_KEY` (and `COOKIE_SECURE=1` behind HTTPS) in `server/.env`.

## Layout

```
server/                     Express + Mongoose API
  server.js                 app wiring: headers, body limits, session + CSRF, routes, static client
  config.js  errors.js      settings / HttpError + error handler
  models.js                 User, Classroom, Enrollment, Announcement, Comment,
                            Assignment, Submission, StoredFile
  services.js               serializers, access checks, file saving, cascade deletes
  middleware/auth.js        JWT-cookie session, CSRF guard, requireLogin(role)
  middleware/upload.js      multer (25 MB files / 3 MB photo)
  routes/                   auth, dashboard, classes, announcements, assignments, profile, files
client/                     React 18 + Vite + React Router
  src/styles.css            the original stylesheet, unchanged
  src/components/           Layout (sidebar), Modal, Avatar, Icon, Comments, Count, ErrorView
  src/pages/                Home, Login, Signup, Dashboard, ClassPage, AssignmentPage, Profile
```

## How the Flask pieces map over

| Flask original | MERN version |
|---|---|
| Flask routes + Jinja templates | Express JSON API + React pages |
| Flask-SQLAlchemy / SQLite | Mongoose / MongoDB |
| `session["uid"]` signed cookie | JWT in an HttpOnly, SameSite=Lax cookie |
| CSRF token in every form | CSRF token inside the JWT, sent back as `X-CSRF-Token` on every write |
| `@login_required(role)` | `requireLogin(role)` middleware |
| `get_class_for_user` / `get_owned_class` | same names in `services.js`, called on every route |
| `cascade="all, delete-orphan"` | explicit `deleteClassroom / deleteAssignment / ...` (also remove files from disk) |
| `upgrade_old_database()` | not needed (MongoDB is schemaless) |
| `static/app.js` (DOM scripting) | React state/effects: modals, tabs via URL hash, toasts, count-up, live photo preview |
| `{% block sidenav %}` | React portal into the sidebar |
| Werkzeug password hashes | bcrypt (`bcryptjs`) |

## API

```
GET  /api/auth/me                  POST /api/auth/signup | login | logout
GET  /api/dashboard
GET  /api/classes                  POST /api/classes            POST /api/classes/join
GET  /api/classes/:id              DELETE /api/classes/:id      POST /api/classes/:id/leave
POST /api/classes/:id/announce     POST /api/classes/:id/announcements/seen
POST /api/classes/:id/assignments  (multipart)
DELETE /api/announcements/:id      POST /api/announcements/:id/comments     DELETE /api/comments/:id
GET  /api/assignments/:id          DELETE /api/assignments/:id
POST /api/assignments/:id/submit   (multipart)
DELETE /api/submissions/:sid/files/:fid       POST /api/submissions/:sid/grade
GET  /api/profile                  PUT /api/profile (multipart)  DELETE /api/profile/photo
GET  /api/files/:fid               GET /api/avatar/:uid          (both permission-checked)
```

## Deliberate differences

* Dates are stored as real instants (the browser converts the teacher's local time to ISO), so deadlines
  are correct for people in different time zones. The Flask app used the server's naive local time.
* Ids are Mongo ObjectIds; the 0–5 colour index that used `id % 6` is derived from the id instead.
* Other students never see each other's e-mail in comments (only the teacher sees e-mails, as before).
