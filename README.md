<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0F766E,100:14B8A6&height=210&section=header&text=Costlyf&fontSize=70&fontColor=ffffff&fontAlignY=38&desc=Why%20pay%20alone%20when%20you%20can%20split%20it%3F&descSize=19&descAlignY=60" alt="Costlyf banner" width="100%" />

**A marketplace for sharing subscription seats: owners list spare slots on family and group plans, subscribers join and pay their share, and a wallet with scheduled payouts sits in between.**

[![Top language](https://img.shields.io/github/languages/top/Hade6556/Costlyf?style=for-the-badge)](https://github.com/Hade6556/Costlyf)
[![License](https://img.shields.io/github/license/Hade6556/Costlyf?style=for-the-badge)](#license)
[![Last commit](https://img.shields.io/github/last-commit/Hade6556/Costlyf?style=for-the-badge)](https://github.com/Hade6556/Costlyf/commits)
[![Stars](https://img.shields.io/github/stars/Hade6556/Costlyf?style=for-the-badge)](https://github.com/Hade6556/Costlyf/stargazers)

[![Express](https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vite.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-auth%20%2B%20db-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Stripe](https://img.shields.io/badge/Stripe-wallet%20%2B%20payouts-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://stripe.com/)
[![Vercel](https://img.shields.io/badge/Vercel-deploy-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)

</div>

---

## What it does

Someone who pays for a Netflix, Spotify, YouTube Premium, VPN or cloud-storage family plan has empty seats. Costlyf lets them list those seats as an offer. Other users browse the catalog, reserve a seat, pay their share by card or from their wallet balance, and receive the access details once the owner accepts. Chat threads, a support desk and an admin area handle the rest, and a nightly job pays owners out.

> **[screenshot placeholder]** Capture the landing page hero, the Join catalog grid with service logos, one offer page with seat slots, and the Wallet page. 1440×900, test data only, no real access credentials.

## Features

- **Catalog** of 25 services across six categories (movies, music, VPN and security, productivity and AI, delivery and education, cloud storage), with per-plan seat prices and caps in `dashboard-app/src/data/services.js`.
- **Offers and seats**: create, edit and delete offers; reserve a seat with a card, after saving a card, or from wallet balance; owner accepts or declines; access details are confirmed by both sides; removal, cancellation and scheduled removal flows.
- **Wallet**: balance, transaction history, top-up via Stripe PaymentIntent, saved payment method via SetupIntent, withdrawal requests, and a daily payout cron.
- **Chat** between owner and subscriber with image upload and system messages, plus unread counts.
- **Support tickets** for users and an **admin area** for withdrawals, chats, tickets and users. Admins are chosen by email or user id in the environment.
- **Accounts** with Supabase Auth: signup, login, password reset, profile with avatar upload, a community charter users must accept.
- **Landing page** with brand logos, how-it-works, testimonials and FAQ, translatable through `messages/en.json`.
- A separate `next-app/` folder holds an early Next.js and next-intl rewrite with six locales. It is not part of the build. **[placeholder: keep, finish or remove]**

## Tech stack

| Layer | Choice |
|---|---|
| API and pages | Express 4 in `server.js`, 76 routes, serves the landing page and the built dashboard |
| Dashboard | React 19, React Router 7, Vite 7, in `dashboard-app/` |
| Auth and data | Supabase Auth, `profiles` table from `supabase/migrations/`, Storage bucket `avatars` |
| Payments | Stripe PaymentIntents, SetupIntents, `payment_intent.succeeded` webhook; currency defaults to EUR |
| Uploads | multer to `/uploads` locally, Supabase Storage on Vercel |
| Deploy | Vercel with `api/index.js` as the serverless entry, rewrites in `vercel.json`, cron at 02:00 for payouts |

The wallet and payment model, including how double charges and double payouts are avoided, is written up in [`docs/STRIPE_WALLET_SETUP.md`](docs/STRIPE_WALLET_SETUP.md).

## Quick start

Requirements: Node 18 or newer, a Supabase project, Stripe test keys.

```bash
git clone https://github.com/Hade6556/Costlyf.git
cd Costlyf
npm install && (cd dashboard-app && npm install)
cat > .env <<'ENV'
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CURRENCY=eur
ADMIN_EMAILS=you@example.com
SITE_URL=http://localhost:3000
ENV
```

Run the three files in `supabase/migrations/` in order in the Supabase SQL editor, and create a public Storage bucket named `avatars`. Then:

```bash
npm run build      # copies static assets, builds the dashboard, copies it to public/dashboard-app
npm run dev        # Express on http://localhost:3000, landing at /, app at /home
```

For hot reload while working on the dashboard, keep the Express server running and start Vite in a second terminal; its dev server proxies `/api`, `/app` and `/media` to port 3000:

```bash
cd dashboard-app && npm run dev     # http://localhost:5173/dashboard-app/
```

Stripe webhooks locally:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

The server also accepts the older variable names `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE`.

## Usage

| Page | What happens there |
|---|---|
| `/` | Landing page |
| `/join`, `/join/:service` | Browse offers, pick a seat, pay |
| `/share` | List your spare seats as an offer |
| `/offer` | Manage an offer and its subscribers |
| `/wallet` | Balance, top-up, withdraw, transactions |
| `/inbox` | Chats with the other side of each seat |
| `/profile`, `/profile/payment-method` | Personal data, privacy, trust, saved card |
| `/help` | Support tickets |
| `/charter` | The community rules every user accepts |
| `/admin/*` | Withdrawals, chats, tickets, users (admins only) |

The seat lifecycle in the API is `reserve` → `accept` (owner) → `access-details` → `confirm-details` (subscriber), with `decline`, `request-removal`, `cancel-subscription` and `schedule-removal` as the exits. All routes are listed at the top of `server.js` by section.

## Contributing

1. The API lives in one file on purpose; add routes next to their section and keep the Stripe webhook before `express.json()` so signature verification keeps working.
2. Dashboard pages go in `dashboard-app/src/pages` and are registered in `main.jsx`. Run `npm run lint` there.
3. New services go in `services.js` with a logo in `media/brand-logos/`.
4. Any change to money flows should be checked against the sequence in `docs/STRIPE_WALLET_SETUP.md` and tested with Stripe test cards.
5. Schema changes are new numbered files in `supabase/migrations/`.

## License

No license file is in the repository yet, so the default "all rights reserved" applies. **[placeholder: add a LICENSE file; the badge above updates by itself]**

Service names and logos belong to their respective owners.
