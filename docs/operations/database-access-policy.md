# Database Access Policy

Canonical security rules live in `../../AI_RULES.md`.

Database access is allowed from:

- backend services
- backend workflows
- database/bootstrap scripts
- explicit local maintenance queries

Database access is not allowed from:

- frontend code
- shared modules
- backend config
- docs tooling

Rules:

- Use credentials only through environment variables.
- Never read, print, log, or copy credential values.
- Keep ad hoc SQL narrow and intentional.
- Use SQL files or migrations for schema changes.
