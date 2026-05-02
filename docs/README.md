# Documentation

Project documentation is split by audience and purpose.

## User

User-facing product documentation belongs in `docs/user`.

Use this area for:

- product usage guides
- feature behavior visible to end users
- deployment-facing help material

## Developer

Developer documentation belongs in `docs/developer`.

Use this area for:

- local development setup
- frontend/backend architecture
- internal APIs and workflows
- implementation notes

## Operations

Project operating policy belongs in `docs/operations`.

Use this area for:

- naming policy
- repository structure policy
- scripts and data policy
- maintenance conventions

Repository-level AI rules stay at the project root:

- `AGENTS.md`
- `AI_RULES.md`

Those files are operational entrypoints for agents and should not be moved into
`docs`.

## Reference

Curated supporting material belongs in `docs/reference`.

Use this area for stable reference data or domain material that should be kept
with the project but is not imported by runtime code.
