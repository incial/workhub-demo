# Dream India CRM / Incial WorkHub - agent guide

## Project in one paragraph

This repository is a React/TypeScript client and Java 17/Spring Boot/PostgreSQL modular monolith for managing education-infrastructure projects through lead, sales, accounts, installation, and feedback workflows. It is a security-sensitive CRM: school contacts, commercial data, staff records, zones, project ownership, and financial workflow must be protected on the server.

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/SECURITY.md](docs/SECURITY.md), and [docs/ENGINEERING_GUIDELINES.md](docs/ENGINEERING_GUIDELINES.md) before changing a cross-cutting path.

## Repository map

- `server/`: Spring API. Controllers route, services own policy/transactions, repositories persist, DTOs define API data.
- `client/`: React/Vite UI. `services/` owns HTTP calls; UI role checks are not security controls.
- `server/src/main/resources/db/migration/`: immutable Flyway production migrations.
- `docs/`: architecture, configuration, engineering, and security documentation.
- `monitoring/` and Compose files: operational monitoring/deployment material.

## Non-negotiable security rules

- Derive the actor from current authentication and the persisted user record. Never authorize a request-provided role, zone, user ID, or mutable display name.
- Use `ZoneAccessService` for project/user zone and executive ownership checks; use `FieldAccessPolicyService` and `WorkflowService` for edits/transitions.
- Keep public registration disabled. User provisioning and role changes must enforce the server-side role hierarchy.
- Do not expose full user directories, Google IDs, tokens, passwords, OTPs, raw errors, stack traces, configuration, or audit-only data through DTOs or logs.
- Keep JWT current-user and token-version checks. Increment token version on password and authorization-role changes.
- Preserve OTP hashing, request/attempt limits, generic public reset responses, and trusted-proxy-only client IP handling.
- Controllers must not catch broad exceptions and convert authorization failures to `400`; use `DomainException`/`ErrorCode` and the global handler.

## Coding method

1. Trace only the relevant page/route, controller, service, policy service, repository, DTO, and tests.
2. Define the role, zone, owner, field, workflow, validation, error, and migration effects before editing.
3. Make the smallest coherent change in the correct layer. Database filtering/pagination happens in repositories; policy happens in services; frontend code is presentation.
4. Add a regression test for bug, access-control, concurrency, or authentication changes.
5. Update `docs/` if architecture, properties, security policy, or workflow changed.

## Compute and resource discipline

- Prefer `rg` and focused tests over broad scans/builds while iterating.
- Run a clean/full backend build only when release verification or stale output requires it; never run concurrent Maven clean/build jobs against `server/target`.
- Avoid N+1 queries, unbounded directories/exports, unnecessary polling, huge client fetches, speculative dependencies, and uncontrolled caches/schedulers.
- Keep transactions short; network/email work belongs in the outbox/background path, not a request transaction.
- Log conservatively and never log secrets or sensitive credentials.

## Verification

```powershell
cd server
.\mvnw.cmd "-Dtest=RelevantTestClass" test
.\mvnw.cmd clean test

cd ..\client
npm run check
npm run build
```

Before handoff, run `git diff --check`, report exactly what was tested, and identify any deployment action (new environment variable, Flyway migration, proxy change, or credential rotation). Do not commit secrets or modify/revert unrelated user changes.
