# Production Deployment Checklist

## Required Environment Variables

### Supabase
- `DATABASE_URL` - Supabase Postgres connection string (prefer pooled if available)
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anon public key (frontend)
- `VITE_SUPABASE_URL` - same as `SUPABASE_URL` (Vite client)
- `VITE_SUPABASE_ANON_KEY` - same as `SUPABASE_ANON_KEY` (Vite client)
- `SUPABASE_JWT_SECRET` - JWT secret (server-side auth verification)

### Twilio
- `TWILIO_ACCOUNT_SID`
- `TWILIO_API_KEY`
- `TWILIO_API_SECRET` (or legacy `TWILIO_API_KEY_SECRET`)
- `TWILIO_AUTH_TOKEN` - required for webhook signature validation
- `TWILIO_PHONE_NUMBER`
- `TWILIO_CONVERSATIONS_API_KEY`
- `TWILIO_CONVERSATIONS_API_SECRET`
- `TWILIO_CONVERSATIONS_SERVICE_SID` (optional; set to avoid auto-creation)
- `PUBLIC_APP_URL` - used to configure Conversations webhook URL
- `TWILIO_FORWARD_TO_NUMBER` (optional; required if using call forwarding)
- `TWILIO_FORWARD_TIMEOUT_SECONDS` (optional)
- `TWILIO_CALL_MIN_DURATION_SECONDS` (optional)

### Booking (Cal.com)
- `PUBLIC_BOOKING_URL` (optional; defaults to `${PUBLIC_APP_URL}/book` when set)
- `VITE_CALCOM_CLIENT_ID`
- `VITE_CALCOM_ACCESS_TOKEN`
- `VITE_CALCOM_USERNAME`
- `VITE_CALCOM_EVENT_SLUG`
- `VITE_CALCOM_API_URL` (optional; defaults to `https://api.cal.com/v2`)
- `VITE_BOOKING_WEBHOOK_URL` (optional; defaults to `/webhook/calcom`)

### AI
- `AI_INTEGRATIONS_OPENAI_API_KEY`
- `AI_INTEGRATIONS_OPENAI_BASE_URL`
- `AI_REPLY_DEBOUNCE_MS` (optional; default 8000)

### Integrations (Optional)
- `INTEGRATION_API_KEY` - allow trusted server-to-server calls via `x-api-key`

## Supabase Setup

1. Create a new Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Create at least one admin user in Supabase Auth (email/password).
4. Set env vars for the app deployment.

## Existing Deployments

If you already have a database, run:

```sql
alter table messages add column if not exists external_id text;
alter table messages add column if not exists source text;
create unique index if not exists idx_messages_external_source on messages(external_id, source);
create table if not exists workflow_states (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null unique references conversations(id) on delete cascade,
  stage text not null default 'new',
  intent text,
  data jsonb not null default '{}'::jsonb,
  last_updated timestamp not null default now()
);
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  provider text not null,
  provider_booking_id text,
  status text default 'confirmed',
  start_time timestamp,
  end_time timestamp,
  timezone text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamp not null default now()
);
create index if not exists idx_workflow_states_conversation_id on workflow_states(conversation_id);
create index if not exists idx_workflow_states_stage on workflow_states(stage);
create index if not exists idx_bookings_conversation_id on bookings(conversation_id);
create unique index if not exists idx_bookings_provider_external on bookings(provider, provider_booking_id);
```

## Twilio Setup

1. Configure your phone number webhooks:
   - Voice: `POST /webhook/twilio-call`
   - Voice status: `POST /webhook/twilio-call-status`
   - SMS: `POST /webhook/twilio`
2. Ensure `PUBLIC_APP_URL` is set so the Conversations webhook can be updated on startup.
3. Confirm Twilio Conversations Service is created (or set `TWILIO_CONVERSATIONS_SERVICE_SID`).

## Security Verification

- Confirm webhook signature validation is enabled (`TWILIO_AUTH_TOKEN`).
- Confirm all `/api/*` routes require Supabase auth.
- Confirm Supabase Auth users are restricted to trusted admins.

## Functional Testing

- Incoming SMS creates conversations and messages.
- AI lead assessment populates within 10-30 seconds.
- AI auto-responder sends replies when enabled.
- Manual replies send via Conversations API.
- Call forwarding sends missed/thank-you follow-up SMS.
- Booking page loads and Cal.com booking success posts to `/webhook/calcom`.

## Monitoring

- Twilio webhook failures (403/500)
- OpenAI usage and latency
- Database connection limits and query performance
