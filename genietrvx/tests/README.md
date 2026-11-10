# Focused security and data-loss regression tests

The application, Vitest configuration, lockfile, and original tests are stored in
`genietrvx (1).zip`. New tests are kept here as readable source instead of
rewriting the binary archive. Overlay this directory onto the extracted app to
run both the original suite and these additions with the existing configuration.
The only production change is the rate-limit expiry comparison in
`src/lib/server/auth.ts`: a failure exactly at expiry must start a new window
(`<=`, not `<`). The new boundary regression fails against the archived source.
No dependencies are changed. Overlay `genietrvx/src` as well as these tests.

## Risk selection

The original unit suite covers document/payroll calculations, import parsing,
i18n, persistence primitives, seeding, and basic payroll generation. The E2E
suite covers successful login and selected role restrictions, but neither suite
has focused tests for invalid session tokens or the backup API's destructive
replacement guardrails.

| Path | Risk | Added coverage |
| --- | --- | --- |
| `src/lib/server/auth.ts` | Stale privileges, forged/expired sessions, repeated login attempts | Real JWT signing/verification, current database role/profile, deleted/inactive accounts, invalid signatures/algorithms/subjects, expiry, throttling threshold/isolation/reset, login-route 429 enforcement |
| `src/app/api/backup/route.ts` | Unauthorized export, wholesale data loss, restored administrator lockout, untrusted JSON | Anonymous/non-admin rejection before storage access, export/import round trip, exact replacement, invalid bodies/schemas, missing usable administrator; rejected imports preserve all existing records |

Backup tests use the real API authorization/error helpers and real in-memory
SQLite and JSON stores. Only the current-session lookup and global store accessor
are mocked; restore, validation, permissions, and response serialization are not.
Authentication tests mock the Next.js cookie boundary and store accessor, while
using real JOSE cryptography and a real isolated JSON store. Fake time makes
expiration and rate-limit tests deterministic.

These are targeted regression tests, not an exhaustive security audit or a
claim of complete coverage. Other gaps include stock movement business rules,
referential deletion rules, and payroll generation filtering/state transitions.

## Run from the repository root

Use Node 24 (as used for verification) so the existing SQLite tests can run.
The temporary extraction leaves the archive and checkout unchanged; the
readable auth source applies the one-line boundary fix on top of the archive.

```sh
repo_root="$PWD"
workdir="$(mktemp -d)"
unzip -q 'genietrvx (1).zip' -d "$workdir"
cp -R "$repo_root/genietrvx/tests/." "$workdir/genietrvx/tests/"
cp -R "$repo_root/genietrvx/src/." "$workdir/genietrvx/src/"
cd "$workdir/genietrvx"
npm ci
npm run check
```

For just the added tests:

```sh
npm test -- tests/unit/auth.test.ts tests/unit/backup.test.ts
```

The application's existing additional checks are `npm run build` and
`npm run test:e2e` (the latter requires Playwright Chromium).
