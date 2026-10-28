# Deploying to Vercel (build step 20)

The app runs on a free Vercel Hobby project. Steps marked 🧑 are done by Jadon, because they need his accounts and keys. Keys are pasted straight into Vercel and never go in chat or the repo.

## 1. 🧑 Create the Vercel project

1. Sign in at [vercel.com](https://vercel.com) with GitHub and choose **Add New → Project**.
2. Import `jadonchan27-pixel/mealtrackingapp`. Vercel detects Next.js, so leave the build settings as they are.
3. Before the first deploy, open **Environment Variables** and add these six, copying each value from `.env.local` on the PC:

   | Name | Where it comes from |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase: Project Settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase: Project Settings → API |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase: Project Settings → API (keep secret) |
   | `ALLOWED_EMAIL` | The one Google account allowed to sign in |
   | `USDA_API_KEY` | `.env.local` |
   | `BRAVE_API_KEY` | `.env.local` |

4. Choose **Deploy**. When it finishes, note the domain, for example `mealtrackingapp.vercel.app`.

The recipe search route (`/api/weeks/:id/candidates`) sets `maxDuration = 300`. Vercel Hobby allows up to 300 seconds, so no setting is needed.

## 2. 🧑 Allow sign-in from the Vercel domain

Sign-in sends the browser back to `<site>/auth/callback`, and Supabase only allows addresses on its list.

1. Supabase → **Authentication → URL Configuration**.
2. Set **Site URL** to `https://<your-domain>.vercel.app`.
3. Under **Redirect URLs**, add `https://<your-domain>.vercel.app/auth/callback`. Keep `http://localhost:3000/auth/callback` so local development still works.

Google needs no change. Its authorized redirect URI is Supabase's own callback (`https://<project>.supabase.co/auth/v1/callback`), which stays the same.

## 3. Smoke test

The automated part only reads. It checks that every page loads signed in on a phone and a desktop screen, with no errors and no sideways scrolling, and that the read-only API routes answer.

On the PC, from the repo folder:

```bash
npm install
npx playwright install chromium        # once
npm run smoke:login -- https://<your-domain>.vercel.app
npm run smoke -- https://<your-domain>.vercel.app
```

`smoke:login` opens a browser window. Sign in with Google yourself; the script saves the session to `e2e/.auth.json` (gitignored) and never sees the password. Run it again if the smoke test says it was sent to sign-in.

### 🧑 By hand, on the live site

These steps write real data, so they're done by hand rather than by the script. Do each on the phone, then check the desktop shows the same.

- [ ] Sign in with Google.
- [ ] Profile: the saved profile and targets show. Save once without changes.
- [ ] Plan: for the coming week, pick cuisines, build the shortlist, pick meals and finalize. (If that week is already final, open it and check the meals and daily totals show.)
- [ ] Batch cooking: the Sunday and Thursday lists show.
- [ ] Shopping: the list shows with sections, packages and a total. Tick one item.
- [ ] Today: confirm one planned meal and check the totals go up.
- [ ] Weight: log today's weight and check it shows in the list and chart.
- [ ] Phone: add the site to the home screen and open it from there.

**Done when:** the smoke test passes and every box above is ticked.
