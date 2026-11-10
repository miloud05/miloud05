# Newcomer setup audit — 2026-11-10

## Scope and method

Audited repository revision `ae769a3` on Ubuntu 24.04, Node `24.22.2`,
npm `11.19.1`. The tracked files were a profile-template README and
`genietrvx (1).zip` (198 entries). No setup docs or package manifest existed
outside the archive. Read the bundled README, `.env.example`, Dockerfile,
package scripts and agent guidance after inspecting the archive.

This was a clean-checkout/extraction rehearsal on an existing Linux machine,
not a newly provisioned OS. Git, Node, npm and unzip were already installed;
their installation was not tested. No project variables were configured.
The original flow used a fresh extraction with no dependencies, build output,
database or environment file. The corrected flow was also replayed in a
separate temporary checkout/extraction using `npm ci` and no existing app data.
Package/browser caches may be shared between runs.

## Findings and corrections

| Step as documented | Observed result or missing information | Correction |
| --- | --- | --- |
| Start at the root README | Only a GitHub profile template; no app name, clone command, prerequisites or setup link. | Replace it with an authoritative clone-to-test guide. |
| `cd genietrvx` from a clean checkout | Exit 1: `No such file or directory`. Source exists only inside the ZIP. | Extract the quoted archive name before changing directory; explain npm's working directory and avoid overwriting an existing extraction. |
| Node 20.9+ prerequisite | Too old for the full workflow: bundled Vitest 5.0.3 declares `^22.12.0 || ^24.0.0 || >=26.0.0`. This is a manifest mismatch, not a claimed Node 20 execution failure. | Recommend the tested Node 24 LTS line; distinguish the app's historical JSON fallback from test-runner compatibility. |
| `npm install` | Succeeded, but can update dependency resolution. Reported 10 vulnerabilities: 7 moderate, 2 high, 1 critical. | Use the bundled lockfile with `npm ci`; record advisories separately rather than upgrade dependencies as an onboarding change. |
| `npm run dev` | Started; `/login` returned HTTP 200. Missing instructions for login, optional env file, stopping the process, storage and network requirements. | Document demo credentials, loopback binding, first-use seeding, private data and font-download prerequisites. |
| `npm run check` | TypeScript, ESLint and all 49 unit tests passed. | Preserve the existing check; document that browsers are not required. |
| `npm run build` | Passed without application changes. Requires network access for Inter/Cairo fonts. | Document that prerequisite and retain the existing build script. |
| `npm run build && npm run test:e2e` | Build passed; all 15 E2E scenarios failed at browser launch: `Executable doesn't exist` for Playwright's Chromium headless shell. | Add `npx playwright install --with-deps chromium` for Linux, or `npx playwright install chromium` on macOS, before E2E. |
| Rerun E2E after browser installation | 14 passed, 1 failed. Detail navigation (`tests/e2e/app.spec.ts:75`, assertion at line 85) captured `Cannot read properties of undefined (reading 'active')`. | Record the remaining browser/application error, without weakening the assertion or claiming an all-green E2E suite. Application debugging is outside this onboarding-docs/small-setup-script scope. |
| E2E configuration | Uses POSIX shell commands, a production build, port 3100, demo accounts, and recursively resets `.e2e/`. These constraints were undocumented. | Document WSL for Windows, build/browser ordering, free port and override, default demo settings, reset scope and sensitive test artifacts. |
| `npm start` after a build | `/login` returned HTTP 200 but Next.js warned that `next start` does not work with `output: standalone`; this is a warning, not a startup failure in the tested release. | Recommend the provided `start:standalone` entry point for built-app use. Note that the unchanged E2E harness still emits the warning. |
| `npm run start:standalone` alternative | The script only launches the generated server; Next.js does not copy static/public assets into standalone output automatically. A server launched before asset copying returned an asset 404. | Copy assets **before** launching; pass an absolute `DATABASE_PATH` outside `.next/` to keep data across rebuilds. Verified the corrected startup separately. |
| Environment/production notes | Docker example omitted `AUTH_SECRET`; changing admin env vars does not reset an existing user because seeding returns when users already exist. | Clarify all three production settings, first-start behavior, data separation and persistence. Docker remains an untested alternative, not a prerequisite. |

## Verification

- Original `npm install`: passed with the advisories above.
- Original `npm run check`: passed (7 files, 49 unit tests).
- Original `npm run build`: passed.
- Dev and `npm start` smoke checks: `/login` returned HTTP 200.
- Original E2E: 15 failures, all missing browser executable.
- `npx playwright install --with-deps chromium`: passed.
- Corrected E2E setup: 14 passed, 1 detail-navigation failure in 2.4 minutes,
  as recorded above. The runtime cause of that browser error was not isolated.
- Separate clean extraction: `npm ci && npm run check && npm run build`
  exited 0; all 49 unit tests passed again without pre-existing app data.
- Corrected standalone startup: `/login` and all 10 referenced static assets
  returned HTTP 200 after copying assets before starting the server.

## Remaining limitations

- The ZIP is unchanged, so its bundled README still contains the historical
  setup instructions. The root README explicitly supersedes them. Extracted
  application files are ignored to avoid committing a duplicate source tree,
  dependencies, local databases or secrets. No application scripts needed to
  change for the verified workflow.
- `npm audit` reported direct Next.js (critical) and Zod (high) advisories and
  transitive Vite (high) advisories. Dependency remediation is outside this
  docs-focused change; do not treat a successful build as safe deployment.
- npm emitted a sandbox-supplied `store-dir` config warning, an ESLint 9
  deprecation warning and npm 11 install-script approval notices. Installation,
  checks and build nevertheless passed; no global configuration or lifecycle
  script security settings were changed.
- Docker, macOS/WSL, Node 22 and the legacy Node 20 JSON-fallback path were not
  executed. The bundled agent notes' `E2E_NODE` override selects the server
  runtime only; it does not make Vitest 5 compatible with Node 20.
