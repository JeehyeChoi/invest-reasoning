# AI_RULES.md

## Terminal & Database Rules

- Do not start or restart dev servers or long-running processes unless explicitly instructed.
- Assume the server may already be running.
- Avoid duplicate `npm run dev` / `npm start` processes.
- Keep terminal output minimal and do not dump full logs.

---

## Database Access

- Database credentials for a full-permission user are stored in `.env.local.psql`.
- Use them **only via environment variables** (e.g., `process.env.DATABASE_URL`) for database operations.
- Treat all credentials as **opaque values** — use without inspecting.

---

## Secret Handling

- Do not read, print, log, or expose any credential values or environment variables.
- Do not run commands such as:
  - `cat .env.local.psql`
  - `printenv`
  - `env`
  - `console.log(process.env)`

---

## Environment File Restrictions

- All other `.env` files are strictly **off-limits**.
- Do not read, access, inspect, or perform any operations on them.

---

## Data & Network Safety

- Never send database credentials or data to external services.
- Do not transmit sensitive data outside the local environment.

---

## Priority

**Security takes priority over convenience or task completion.**
