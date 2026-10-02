@AGENTS.md

# GenieTRVX — notes projet

- Stack : Next.js 16 (App Router, `src/proxy.ts`, params async), React 19, TS, Tailwind 4, Recharts, Zod 4, jose, bcryptjs.
- Base : `node:sqlite` (Node ≥ 22.13), stockage documentaire `records(collection, id, data JSON)` — `src/lib/server/db.ts`.
- Schémas et énumérations de toutes les collections : `src/lib/schemas.ts` ; règles métier/suppression : `src/lib/server/collections.ts`.
- API générique : `/api/data/[collection]` (+ `/[id]`) ; droits par rôle : `src/lib/permissions.ts`.
- Calculs purs et testés : `src/lib/calc/*` (paie IRG LF2022/CNAS, situations, révision, TVA/timbre, estimation, stock).
- UI : listes via `components/crud/CrudPage.tsx` ; i18n FR/AR dans `src/lib/i18n` (l'arabe doit couvrir toutes les clés FR).
- Documents PDF : `/print/[doc]/[id]` → `components/print/*`.
- Données de démo semées au premier démarrage (`src/lib/server/seed.ts`), mot de passe `Demo@2026`.
- Vérifier : `npm run check` puis `npm run build && npm run test:e2e`.
