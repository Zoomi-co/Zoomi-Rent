# Production Deployment Checklist

## Prepare for publish

Right before deploying:

1. **Build and lint**
   ```bash
   npm run build
   npm run lint
   ```
   Fix any errors before deploying.

2. **Environment**  
   Ensure all required env vars are set in your hosting provider (see below). Use **live** Stripe keys and **production** Clerk keys.

3. **Optional:** Set `NEXT_PUBLIC_APP_URL` to your production URL (e.g. `https://rent.zoomi.co`) so Open Graph and social previews use the correct base URL.

---

## Environment Variables (Vercel / hosting)

Set these in your hosting provider's environment variables:

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk production key |
| `CLERK_SECRET_KEY` | Yes | Clerk production secret |
| `STRIPE_SECRET_KEY` | Yes | Stripe live key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | Stripe live publishable key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Webhook signing secret for production endpoint |
| `RESEND_API_KEY` | Yes | For customer emails; verify rent.zoomi.co domain |
| `UPSTASH_REDIS_REST_URL` | Yes | Required for serverless (Vercel); file storage is read-only |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Redis token |

Optional: `GOOGLE_DRIVE_ROOT_FOLDER_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` for document storage.

## Pre-deploy

- [ ] Run `npm run build` locally to verify no errors
- [ ] Run `npm run lint`
- [ ] Ensure all env vars above are set in Vercel (or hosting) project settings
- [ ] Use Stripe **live** keys in production (not test keys)
- [ ] Use Clerk **production** keys (add production domain in Clerk Dashboard)

## Clerk

- [ ] Add production domain (e.g. `rent.zoomi.co`) in Clerk Dashboard → Domains
- [ ] Configure redirect URLs for production
- [ ] Enable Email verification code; disable other methods if desired
- See [CLERK_PRODUCTION.md](CLERK_PRODUCTION.md) for details

## Stripe

- [ ] Create production webhook: `https://yourdomain.com/api/stripe/webhook`
- [ ] Select events: `customer.subscription.*`, `invoice.*`, `customer.*` (as needed)
- [ ] Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`
- [ ] Configure Customer Portal for production (disable cancellation if using End Services flow)

## Resend

- [ ] Verify `rent.zoomi.co` (or your domain) in Resend Dashboard
- [ ] Set `RESEND_FROM_EMAIL` if different from default
- [ ] Set `RESEND_TO_EMAIL` for new customer notifications

## Upstash Redis

- [ ] Create database at [console.upstash.com](https://console.upstash.com)
- [ ] Copy REST URL and token to env vars
- Required: units, properties, pending-customers, manual-expenses use Redis in serverless

### Keepalive cron

Upstash archives free-tier databases after a prolonged period with no commands
(its FAQ states a minimum of 14 days, with warning emails first). `vercel.json`
schedules `GET /api/cron/keepalive` once a day; the route writes a timestamp to
the dedicated `zoomi:keepalive` key and touches no application data.

- Vercel cron jobs only run against the **production** deployment, so this takes
  effect once the change is deployed to production.
- [ ] Optional: set `CRON_SECRET` in Vercel so only its cron requests are
      accepted (Vercel sends it as `Authorization: Bearer $CRON_SECRET`).
- Verify after deploy: `curl https://rent.zoomi.co/api/cron/keepalive` (add
  `-H "Authorization: Bearer $CRON_SECRET"` if the secret is set) should return
  `{"ok":true,"pingedAt":"..."}`.

## Post-deploy

- [ ] Test customer login flow
- [ ] Test Stripe webhook (create test subscription, verify it appears)
- [ ] Test admin login and finances
- [ ] Verify new customer emails are received

## Debug / test endpoints

These are admin-protected but consider restricting in production if desired:

- `/api/admin/revenue/debug` – Stripe subscription debug info
- `/api/admin/test-email` – Sends test new-customer email
