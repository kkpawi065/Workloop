# Deploying WorkLoop on Netlify

The app has a small backend (`/api/gsheets`, `/api/analyze-teacher`, `/api/chat`). On Netlify it runs as a
serverless function in `netlify/functions/api.mts`, so the site no longer needs a separate server.

## One-time setup

1. **Netlify -> Site configuration -> Environment variables**, add:
   | Name | Value | Required |
   |---|---|---|
   | `GEMINI_API_KEY` | your Gemini key | yes (AI features) |
   | `ALLOWED_EMAIL_DOMAINS` | e.g. `school.ac.th` (comma separated) | recommended: limits AI use to school accounts |
   | `FIREBASE_PROJECT_ID` | `youthful-kit-0cf5x` | no (this is the default) |

   Tick **Contains secret values** for `GEMINI_API_KEY`.

2. **Firebase Console -> Authentication -> Settings -> Authorized domains -> Add domain**:
   `workloop69.netlify.app` (and any custom domain). Without this, Google sign-in fails with
   "Failed to sign in".

3. **Firebase Console -> Firestore Database -> Rules**: paste the contents of `firestore.rules` and **Publish**.
   (Changing the file in GitHub does not update the live rules.)

4. Netlify build settings are read from `netlify.toml` (build command `npm run build:netlify`, publish `dist`).
   Trigger a new deploy after adding the variables: **Deploys -> Trigger deploy -> Clear cache and deploy site**.

## Checking it works

- Open `https://<your-site>/api/health` -> should show `{"status":"ok"}`.
- Sign in with Google -> the dashboard should show live sheet data, not the "Temporary Backup Data (Offline)" banner.
- Open the AI chat and the teacher analysis once. If they fail, check **Netlify -> Logs -> Functions -> api**.

## Behaviour changes compared with the AI Studio server

- AI endpoints now require a real Google sign-in. Guest (anonymous) sessions can view cached data but cannot use AI.
- `/api/analyze` was removed (the app never called it).
- The Sheets proxy cache is now separate per user token.
- Errors from Gemini are logged on the server instead of being returned to the browser.

## Notes

- `server.ts` is unchanged so the app still runs on AI Studio / Cloud Run, but it does **not** have the
  protections above. Do not expose it publicly as is.
- Function time limits depend on your Netlify plan. If long AI answers time out, check the function logs first.
