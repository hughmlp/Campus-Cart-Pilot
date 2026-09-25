# Campus Cart

Campus Cart is a private, independent Notre Dame student/staff research pilot that records shopping requests and test-mode card-setup interest without placing orders.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/campus-cart run dev` — run the mobile-first web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Runtime-managed: `DATABASE_URL`, Clerk keys
- Shared config: `CAMPUS_CART_INVITE_CODES`, `CAMPUS_CART_SUPPORTED_MERCHANTS`
- Optional shared config: `CAMPUS_CART_RESEARCHER_EMAILS` (comma-separated exact emails)
- Optional secret: `STRIPE_SECRET_KEY` using a Stripe test key; without it card setup is truthfully disabled
- Voice transcription uses Replit AI Integrations for OpenAI; recordings are temporary and deleted after each transcription attempt

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- API contract: `lib/api-spec/openapi.yaml`
- Database schema: `lib/db/src/schema/campus-cart.ts`
- API routes: `artifacts/api-server/src/routes/campus-cart.ts`
- Web app: `artifacts/campus-cart/src`

## Architecture decisions

- Real purchasing is disabled by design.
- Card collection uses Stripe-hosted Checkout in `mode=setup`; the app never accepts card numbers or CVC.
- Card connection is marked complete only after server-side Checkout-session verification.
- Test and live data must never be mixed; this prototype exposes only test mode.
- Research access is an exact email allowlist in `CAMPUS_CART_RESEARCHER_EMAILS`.

## Product

- Invite-gated, verified `@nd.edu` participant onboarding
- Editable shopping request with item, category, optional merchant, and maximum all-in budget
- Truthful merchant support/result status with no simulated purchase behavior
- Optional Stripe test-mode card setup and disconnect
- Protected anonymized research dashboard, funnel metrics, rankings, feedback, and CSV export

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run OpenAPI codegen after every contract change.
- Configure at least one exact researcher email before expecting `/research` access.
- Stripe must be test mode (`sk_test_`); other keys are treated as unavailable.
- Invite codes are non-secret pilot access controls, not authentication; Clerk owns identity and email verification.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
