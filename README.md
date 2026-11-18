# 🎙️₦ Voice Budget

**Talk your money. E go arrange am.**

A voice-first budgeting web app for Nigerians. Speak or type in **English or Pidgin**, and the app records your income, spending and savings, sorts each spend into the right pot, and tells you what you can safely spend today.

> "Salary don land, 200k" · "I chop 1,500 for mama put" · "I enter keke 800 and buy data 2k" · "Wetin remain for my feeding?"

## What it does (v0.1)

| Feature | How |
|---|---|
| 🔒 **Savings vault** | Starting savings are kept apart. Taking money out needs a written reason. |
| 💰 **Income** | "Salary don land 200k", "I collect 70k today". "Salary 200" is read as ₦200,000 (with a warning). |
| 🎯 **Budget pots** | Data, Transport, Feeding, Rent, Power, Family, Giving, Enjoyment, Self-care, Other. Fully editable; add your own. Set them by voice: "put 20k for data, 60k for transport". |
| 🧾 **Spending by voice** | Several items in one sentence, "yesterday", "last Friday", "2k", "1.5k", "fifty thousand", "₦2,500". |
| ✅ **Confirmation card** | Nothing is saved until you check it. Fix amount, pot, note or date with one tap. |
| 📊 **Safe to spend today** | Money left in your pots ÷ days left in your budget month. Alerts at 50%, 80% and 100%. |
| ❓ **Ask questions** | "Wetin remain for feeding?", "How much I don spend on transport this week?" |
| ↩️ **Corrections** | "Cancel am", "No be dat one", "Change am to 3k". |
| 📅 **Budget month** | From payday (e.g. the 25th) or calendar month. Leftovers roll over or go to savings. |
| 🔊 **Talk back** | Optional spoken replies. Replies in Pidgin or English. |
| 📴 **Works offline** | Installable on your phone's home screen. Saves instantly on the phone and syncs to your account when online. |

## Accounts and sync (v0.2)

- **Continue with Google** (Supabase Auth), or **use without an account**. Guest data moves into the account when you sign in later.
- **Offline-first:** every change is saved on the phone instantly, then uploaded to Supabase in the background. It works without data and catches up when you're back online. Changes made on another device are pulled in when the app reopens.
- **Database:** Supabase Postgres (London), tables `profiles`, `pots`, `transactions`. Row Level Security means each user can only ever read or change their own rows.
- **Delete my account** calls the `delete-account` edge function, which removes the user and every row they own.
- **Privacy notice:** `public/privacy.html` (NDPA 2023 / GAID 2025 + GDPR).

Supabase project: `voice-budget` (`maqsukzzzmxntxvzhtpy`). The URL and publishable key in `src/lib/config.ts` are public by design; override them with `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` if needed.

## How the "understanding" works

1. **Voice → text:** the browser's built-in speech recognition (free; Chrome on Android works best; accent set to English (Nigeria)).
2. **Text → money entry:** a built-in **Naija money parser** (`src/lib/parser.ts` + `src/lib/dictionary.ts`). Instant, free, offline, with 47 tests of real Pidgin and English sentences.
3. **Claude as backup (optional):** when the local parser is unsure, the app asks Claude through `api/parse.ts`. This only runs if you deploy to Vercel with an `ANTHROPIC_API_KEY`.
4. **The maths is never done by AI.** All totals come from plain code (`src/lib/engine.ts`).

## Run it in VS Code

You need **Node.js 20+** ([nodejs.org](https://nodejs.org)) and **Git**.

```bash
git clone https://github.com/Okiejoedev/voice-budget-app.git
cd voice-budget-app
code .            # opens VS Code
npm install
npm run dev       # opens on http://localhost:5173
```

- **On your phone (same Wi-Fi):** `npm run dev` also prints a `Network:` address like `http://192.168.x.x:5173`. Note that phones only allow the microphone on **https** or localhost, so for voice on your phone use the Vercel link below.
- **Run the tests:** `npm test`
- **Production build:** `npm run build`

## Put it online (free) with GitHub Pages

The repo has a workflow (`.github/workflows/deploy-pages.yml`) that builds, tests and publishes the app on every push to `main`.

1. One-time setup: on GitHub open the repo → **Settings → Pages** → under **Build and deployment → Source**, choose **GitHub Actions**.
2. Go to the **Actions** tab → **Deploy to GitHub Pages** → **Run workflow** (or just push a change).
3. When it turns green, the app is live at **https://okiejoedev.github.io/voice-budget-app/**.
4. On your phone, open that link in Chrome → ⋮ menu → **Add to Home screen**.

GitHub Pages only hosts static files, so the optional Claude fallback (`api/parse.ts`) doesn't run there. The built-in Naija parser handles everything, offline and free. Use Vercel (below) if you want the Claude fallback.

## Or put it online (free) with Vercel

1. Go to [vercel.com](https://vercel.com) → sign in with GitHub → **Add New → Project** → import `voice-budget-app`.
2. Leave the defaults (Vercel detects Vite) → **Deploy**. You get an `https://….vercel.app` link with voice working on your phone.
3. *(Optional, switches on Claude for tricky sentences)* Project → **Settings → Environment Variables** → add `ANTHROPIC_API_KEY` (from [console.anthropic.com](https://console.anthropic.com)) → **Redeploy**.
4. On your phone, open the link in Chrome → ⋮ menu → **Add to Home screen**.

Every `git push` to `main` redeploys automatically.

## Project map

```
src/
  lib/
    dictionary.ts   Naija money words: pots, income, plan, savings, questions, undo
    money.ts        "2k", "fifty thousand", "₦2,500" → numbers; dates like "yesterday"
    parser.ts       Sentence → intent + items (offline)
    parser.test.ts  47 tests with real English/Pidgin phrases
    understand.ts   Local parser first, Claude fallback, output safety checks
    engine.ts       Budget periods, pots, safe-to-spend, alerts, replies
    store.ts        Saves data on the phone (localStorage)
    speech.ts       Microphone + talk-back
  components/       Onboarding, Home, Plan, History, Settings, ConfirmSheet
api/parse.ts        Vercel serverless function that calls Claude (optional)
public/             App icons, manifest, offline service worker
```

## Privacy

- Guests: data is stored **only in the browser on the phone**. Signed-in users: also in Supabase (London), protected by Row Level Security.
- Voice is turned into text by the browser's speech service (Google, in Chrome). The app keeps only the text.
- When Claude is switched on, only the sentence and your pot names are sent, never your balances.
- Privacy notice, data download and account deletion are built in.

## Roadmap

- [x] Accounts and cloud sync (Supabase + Google sign-in)
- [ ] Debts: "I borrow Tunde 5k"
- [ ] Several money sources: cash, Opay, GTB, PiggyVest
- [ ] Share a bank SMS alert into the app to log it
- [ ] Weekly voice summary; payday split template
- [ ] Android app (Expo) and a WhatsApp front door
- [ ] Yoruba, Igbo and Hausa words

---
Built by Joseph Okeoma (Okiejoe) with Claude.
