# Backend Structure Policy

Use the backend structure to separate vocabulary, policy, and behavior.

```text
shared
  -> public vocabulary and contracts

backend/config
  -> backend policy and configuration

backend/services
  -> domain behavior and data processing

backend/clients
  -> external API adapters
```

## Core Rule

The backend should make it easy to answer three questions:

- What names does the system use?
- What policy applies to those names?
- What code performs the work?

Keep those answers in different layers.

## Shared Vocabulary

Shared modules may define public vocabulary used by both frontend and backend:

- factor keys
- axis keys
- metric keys
- method names
- API request/response contracts

Shared vocabulary should be safe to import from either side. It must not depend
on backend config, database access, filesystem access, env secrets, or external
clients.

Shared should define names, not backend operating policy.

## Backend Config

`backend/config` is where backend policy lives.

Use config for definitions that explain how public names behave inside the
backend:

- active factor/axis/metric topology
- metric kind or classification
- duration and validation policy
- active method selection
- config/display file resolution
- backend-only defaults and overrides

If changing a file changes how the system interprets data, routes work, or
pipeline behavior, it probably belongs in config rather than services.

Config should stay mostly declarative. Avoid database calls, external HTTP calls,
or long procedural workflows in config files.

## Backend Services

`backend/services` is for behavior.

Services should perform domain work:

- read or write database data
- construct time series
- resolve periods
- build signals
- run clustering
- enrich or validate data
- coordinate domain-specific operations

Services may import backend config, shared vocabulary, backend clients, and
local service types.

Services should not be used as a dumping ground for registries or static policy.

## Backend Clients

`backend/clients` wraps external systems.

Put external raw response types near the client that consumes them. Do not move
vendor-specific response shapes into shared unless the frontend truly consumes
that public shape.

Clients should not own domain policy. They fetch or adapt external data; services
decide how that data is used.

## Local Types

Use `types.ts` for types local to a folder or domain module.

Good uses:

- service input/output helper types
- DB row shapes used only by that service area
- intermediate calculation types
- internal workflow context types

Do not put frontend API contracts in backend-local `types.ts`. If frontend and
backend both consume a contract, move it to a shared domain module.

## Schema Naming

Use `schema` only for runtime validation.

Good schema use:

- parsing API request bodies
- validating untrusted external responses
- validating env/config input
- validating user input

Avoid naming a file or folder `schemas` if it only contains TypeScript types,
key lists, or static definitions. Those should be named according to their role,
such as `types`, `constants`, `metrics`, `factors`, or `methods`.

## Naming Tone

Prefer short domain nouns for core project concepts:

- `factors`
- `metrics`
- `methods`
- `types`

Avoid long explanatory filenames when the folder path already gives context.
For example, a metric policy file under backend config can simply be named
`metrics`, because the path explains the rest.

## Dependency Direction

Allowed direction:

```text
API routes        -> backend services
backend services -> backend config
backend services -> backend clients
backend services -> shared
backend config   -> shared
frontend         -> shared
```

Avoid:

```text
shared -> backend
frontend -> backend services
frontend -> backend clients
backend clients -> frontend
```

API routes are the normal bridge from frontend-facing HTTP to backend services.

## Review Checklist

- Public vocabulary is in shared, not hidden inside backend services.
- Backend policy is in backend config, not buried in services.
- Services contain behavior, not static registries.
- External raw types live near backend clients.
- Folder-local `types.ts` files are only local contracts.
- Runtime validation files are actually schemas.
- Frontend-consumed contracts are not imported from backend folders.
- Shared modules do not import backend modules.
