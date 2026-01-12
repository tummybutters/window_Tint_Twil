# Twilio Conversations Dashboard

## Overview
Single-tenant SMS + Conversations dashboard with AI auto-responder and lead assessment. Designed as a template you can clone per company, swap config values, and deploy.

## Stack
- Frontend: React + Vite, TanStack Query, Tailwind
- Backend: Express + TypeScript
- Database: Supabase Postgres (Drizzle ORM)
- Auth: Supabase Auth (JWT verified server-side)
- Messaging: Twilio Conversations + SMS
- AI: OpenAI-compatible API (gpt-5 / gpt-5-nano)
- Booking: Cal.com Atoms embed + webhook

## Key Paths
```
client/src/pages/Dashboard.tsx
client/src/pages/Booking.tsx
client/src/components/dashboard/DashboardLayout.tsx
client/src/components/AuthScreen.tsx
client/src/lib/supabaseClient.ts
client/src/config/booking.ts
server/routes/index.ts
server/routes/api.ts
server/routes/webhooks.ts
server/services/ai-workflow.ts
server/services/inbound-message.ts
server/services/call-handling.ts
server/services/workflow.ts
server/services/booking.ts
server/services/notifications.ts
server/twilio.ts
server/config/company.ts
server/config/prompts.ts
shared/schema.ts
supabase/schema.sql
```

## API Routes
- `POST /webhook/twilio-call`
- `POST /webhook/twilio-call-status`
- `POST /webhook/twilio`
- `POST /webhook/conversations`
- `POST /webhook/calcom`
- `GET /api/conversations`
- `GET /api/conversations/:phone/messages`
- `POST /api/conversations/:phone/messages`
- `GET /api/conversations/:phone/assessment`
- `POST /api/conversations/:phone/join`
- `POST /api/twilio/token`
- `POST /api/conversations/init`
- `POST /api/conversations/:phone/ai-toggle`
- `DELETE /api/conversations/:phone`

## Onboarding a New Company
1. Update `server/config/company.ts` (business name, owner name, URLs, call messages).
2. Update `client/src/config/branding.ts` (logo/name).
3. Update `client/src/config/booking.ts` (Cal.com client id/username/event slug).
4. Provision Supabase and run `supabase/schema.sql`.
5. Configure env vars (see `PRODUCTION_CHECKLIST.md`).
6. Deploy.

## Notes
- All `/api/*` routes require Supabase Auth JWT.
- Webhooks validate Twilio signatures when `TWILIO_AUTH_TOKEN` is set.
- Conversations webhook URL is configured using `PUBLIC_APP_URL`.
