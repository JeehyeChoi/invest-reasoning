# Frontend To Backend Flow

Use this as the default architecture for user-facing screens that need live
data.

```text
page
  -> feature component
  -> feature service fetcher
  -> API route
  -> backend service
  -> database / external client / workflow
```

## Layer Responsibilities

### Page

Pages own routing concerns: route params, search params, layout composition, and
which feature component should render. They should stay thin and should not call
backend services directly.

Server Components can technically call backend code directly, but this project
uses API routes as the normal boundary for user-facing live data so the data
contract stays visible and reusable.

### Feature Component

Feature components own UI state, loading state, error state, interaction state,
and rendering. When they need live data, they call a feature service fetcher
instead of importing backend code.

### Feature Service Fetcher

Frontend feature fetchers call internal API routes only. They may build request
URLs, serialize request bodies, check HTTP status, and return typed JSON.

They should not import backend services, backend clients, secrets, database code,
or call external vendor APIs directly.

### API Route

API routes translate HTTP into domain calls. They parse params/body, validate or
normalize request data at the boundary, call backend services, and return
HTTP-shaped responses.

HTTP concerns belong here, not in backend services.

### Backend Service

Backend services own domain logic and data access. They may call the database,
backend clients, or workflows.

They should return domain data, not `Request`, `Response`, `NextResponse`, or
UI-shaped state.

### Backend Client

Backend clients wrap external services. External HTTP calls belong on the server
side behind backend services and API routes.

Frontend code should not call vendors directly unless the product explicitly
requires a public client-side SDK.

## Shared Code

`shared` is for code that is safe and meaningful on both sides of the
frontend/backend boundary.

Shared code should be organized by domain first, not by technical artifact type.
Keep related types, schemas, constants, and pure utilities together under the
same domain.

Prefer:

```text
shared/<domain>/types
shared/<domain>/schema
shared/<domain>/constants
shared/<domain>/utils
```

Avoid top-level buckets like:

```text
shared/types
shared/schemas
shared/constants
shared/utils
```

Those buckets hide ownership once a value belongs to a real domain.

Good shared code:

- API request/response contracts used by both frontend and backend.
- Serializable types and boundary schemas.
- Constants used by both sides.
- Pure formatting, parsing, or normalization helpers.

Do not put these in shared:

- Database access.
- External API clients.
- Secret/env access.
- Filesystem or process logic.
- React components.
- Backend workflow implementations.

## Schema And Type Rule

Use schemas at trust boundaries: API bodies, external API responses, database
rows when needed, env config, and user input.

When a runtime schema exists, derive the TypeScript type from the schema instead
of hand-maintaining a duplicate type.

Use plain TypeScript types for internal data shapes that do not need runtime
validation.

## Naming Rules

Route names should match the data concept exactly. If a feature shows a specific
sub-domain, include that sub-domain in both the page route and the API route.

Avoid broad names for narrow data. For example, do not put cluster-specific data
under a generic market overview route unless it really represents the whole
market overview concept.

Remove aliases and redirects unless there is a deliberate migration reason.

## Exceptions

Keep exceptions rare and explicit.

- Server-only admin, diagnostics, or internal pages may call backend services
  directly if they are not part of the user-facing feature flow.
- Build-time or static pages may read local content directly.
- Internal job routes may call workflows directly.
- Pure layout pages that only compose navigation and child components do not
  need a feature service.
- Backend clients may call external APIs because they are server-side adapters,
  not frontend feature fetchers.

When a user-facing page needs live data, prefer the standard flow.

## Review Checklist

- Page does not import backend services.
- Feature component does not import backend services or backend clients.
- Frontend feature fetcher calls an internal API route, not an external vendor
  URL.
- API route calls backend services and returns HTTP-shaped responses.
- Backend service contains domain/data logic and returns domain data.
- External vendor calls live behind backend clients.
- Shared code is domain-owned and safe on both frontend and backend.
- Schema/type ownership has a single source of truth.
- Route names match the real domain concept.
