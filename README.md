# Meal Tracking App

Personal calorie tracker and weekly meal planner. Project docs live in [docs/](docs/).

## Development

Requires Node.js 22.

```bash
npm install
npm run dev          # start the app at http://localhost:3000
npm test             # run unit tests
npm run lint         # ESLint
npm run format:check # Prettier
npm run typecheck    # TypeScript
npm run build        # production build
```

## Configuration

Copy `.env.example` to `.env.local` and fill in the values. `.env.local` is never committed.

## Database

Migrations live in `supabase/migrations/`. Apply them in order (`001_schema.sql`, `002_rls.sql`, `003_ingredient_range.sql`, then `004_price_limits.sql`) in the Supabase dashboard's SQL Editor. When a migration changes a table, update `lib/db/types.ts` to match.

## Deploying

See [docs/DEPLOY.md](docs/DEPLOY.md) for the Vercel setup, the Supabase sign-in URLs and the smoke test (`npm run smoke:login`, then `npm run smoke -- <url>`).
