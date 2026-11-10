# GenieTRVX — getting started

GenieTRVX is a French/Arabic construction-management ERP built with Next.js,
React and TypeScript. **The application is distributed in
[`genietrvx (1).zip`](<genietrvx (1).zip>), not as a checked-out source directory.**
This README is the current setup guide; it supersedes the setup commands in the
archive's bundled README. The archive is preserved unchanged.

## Prerequisites

- Install [Git](https://git-scm.com/downloads),
  [Node.js 24 LTS](https://nodejs.org/en/download) (including npm), and an unzip tool.
  Node 22.13+ on the Node 22 release line is also compatible with the declared
  dependency requirements, but was not exercised in this audit. Do not use Node 20
  for the full test workflow: the bundled Vitest 5 requires Node
  `^22.12.0 || ^24.0.0 || >=26.0.0`, despite the older app README saying 20.9+.
- Commands below use a POSIX shell (Linux, macOS, or WSL). The E2E configuration
  itself uses POSIX commands and environment assignments; use WSL on Windows.
- Allow network access to the npm registry, Google Fonts during dev/build
  (`next/font/google` downloads Inter and Cairo), and Playwright's browser CDN
  for E2E setup. Linux browser dependencies may require sudo/root access.
- No separate database server, Docker daemon, API key, or paid service is needed
  for this local workflow. Node 24 uses built-in SQLite.

## Clone, extract and install

```sh
git clone https://github.com/miloud05/miloud05.git
cd miloud05
unzip 'genietrvx (1).zip'
cd genietrvx
node --version
npm --version
npm ci
```

Run `unzip` from the repository root **once**; it creates `genietrvx/`. On a
machine without the `unzip` command, use its archive manager to extract the ZIP
into the repository root, then enter `genietrvx/`. Do not run npm in `miloud05/`:
the package and lockfile are inside the extracted directory. Use `npm ci` to
install the lockfile without updating dependency versions. Re-extracting over
an existing working directory can overwrite local changes.

All remaining commands run inside `genietrvx/`. The extracted directory is
ignored by Git; it is a local working copy, not a second tracked source tree.

## Start the local demo

```sh
npm run dev -- --hostname 127.0.0.1
```

Open <http://localhost:3000/login> and sign in with `admin@genietrvx.dz` /
`Demo@2026`. First access seeds demo users and business data. Stop the server
with Ctrl+C before moving on. To use another port, add `--port 3001`.

No environment file is required for the demo. Optional settings are in
`.env.example`; copy it to `.env.local` only if you need to change them.
By default SQLite data and the generated session-signing secret are stored
under `genietrvx/data/`. Keep that directory private and writable, and preserve
it between runs. If it is unwritable, the app warns and falls back to a temporary
directory; that is not durable storage. Do not commit data or secrets.

## Checks and production build

```sh
npm run check
npm run build
```

`check` runs TypeScript, ESLint and Vitest (49 tests at the audited revision).
These checks do not require Playwright browsers. The build uses the same local
dependencies and downloads its Google Fonts; allow those requests rather than
disabling certificate validation if the build cannot fetch fonts.

### Browser tests (optional)

Known result at the audited revision: **14/15 scenarios pass** after browser
installation. Detail navigation captures a browser error reading `active` from
`undefined`; see the [audit log](docs/setup-audit.md). The unit checks and build
above pass independently of this remaining E2E failure.

On Linux, install Chromium and its system libraries before running the suite:

```sh
npx playwright install --with-deps chromium
npm run build
npm run test:e2e
```

On macOS, use `npx playwright install chromium` instead. Run the browser install
again if a dependency change requires a different Playwright browser revision.
The suite starts/stops its own server on port **3100**; keep that port free.
To override it, use `E2E_PORT=3101 npm run test:e2e`.

Tests use demo credentials and seeded business records. Run them with the
default demo settings, without production overrides in the shell or
`.env.local` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `GENIETRVX_DEMO`). The harness
deletes and recreates **only `.e2e/`** on every run; never store real data there.
Reports and failure artifacts are in `test-results/` (traces/screenshots may
contain app data). A prior build is required because the harness uses
`next start`, not the dev server. It currently emits a standalone-output warning;
see the audit log below.

### Run the built standalone app locally

The bundled `npm start` uses `next start` although the app configures standalone
output. Use the standalone entry point and copy static assets after each build:

```sh
npm run build
mkdir -p .next/standalone/.next
cp -R .next/static .next/standalone/.next/
if [ -d public ]; then cp -R public .next/standalone/; fi
HOSTNAME=127.0.0.1 DATABASE_PATH="$PWD/data/genietrvx.db" npm run start:standalone
```

Open <http://localhost:3000/login>. `DATABASE_PATH` is absolute here because the
standalone server changes its working directory; this keeps the same data
outside `.next/`. Stop any dev server using port 3000 first.

## Before deploying

This is a **local onboarding guide**, not a production security sign-off.
The audit found dependency security advisories; review `npm audit` and resolve
them before exposing the app. Do not blindly run `npm audit fix --force` as part
of setup: it can change the locked dependency set.

Before the first startup against a new production database, set a unique
`ADMIN_PASSWORD`, a private random `AUTH_SECRET` of at least 32 characters, and
`GENIETRVX_DEMO=false`. For example, generate a secret with
`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`
and store it privately, not in Git. `ADMIN_EMAIL` optionally changes the admin
login. Changing these variables does **not** reset existing users or remove
already-seeded demo data. Keep production data separate from the demo database
and E2E directory.

The archive also includes a Dockerfile and a bilingual feature guide. Its Docker
example omits `AUTH_SECRET`; supply it as well as the other production settings
and persist `/app/data`. Docker deployment was not exercised in this audit.

## Setup audit

See [the setup audit log](docs/setup-audit.md) for the original failures,
corrections, verification results and remaining limitations.
