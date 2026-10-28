# Facet 7: Login, Devices and Syncing

_Step 2 facet discussion. Builds on [01-project-plan.md](01-project-plan.md)._

## App type

- One **web app** that works in a desktop browser and can be installed to the phone's home screen (Progressive Web App).
- No separate native iOS or Android app.
- Layout works on both phone and desktop screen sizes.

## Login

- **Sign in with Google.**
- Single user: only Jadon's Google account is allowed in.

## Syncing

- All data lives on the server, so phone and desktop always show the same plan, logs and shopping list.

## Notifications

- **Push notifications on the phone** for:
  - the Saturday shortlist review,
  - the Sunday weigh-in reminder,
  - automatic calorie-target changes.
- Note: on iPhone, web push only works when the app is installed to the home screen (iOS 16.4 or later).

## Offline shopping list

- The current week's shopping list is available offline in the store.
- Items can be checked off while offline; changes sync when the connection returns.

## Hosting and cost

- Use **free tiers** for hosting, database and any external services.
- Anything that can't fit a free tier (e.g. web search for recipes, H-E-B price lookups, nutrition database calls) is flagged in step 4, architecture, before it's chosen.
