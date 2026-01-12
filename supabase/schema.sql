create extension if not exists "pgcrypto";

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  conversation_sid text unique,
  name text,
  last_message text,
  last_activity timestamp not null default now(),
  unread_count text default '0',
  ai_enabled boolean not null default true,
  ready_to_book boolean default false,
  booking_notes text,
  call_suppressed_at timestamp,
  needs_reply boolean not null default false
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  text text not null,
  timestamp timestamp not null default now(),
  direction text not null,
  status text default 'sent',
  media_url text,
  media_type text,
  external_id text,
  source text
);

create table if not exists lead_assessments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null unique references conversations(id) on delete cascade,
  stage text,
  probability text,
  est_value text,
  sentiment text,
  notes text,
  last_updated timestamp not null default now()
);

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
  job_value decimal(10,2),
  created_at timestamp not null default now()
);

create table if not exists calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  call_sid text unique,
  direction text not null,
  status text,
  duration_seconds integer,
  recording_url text,
  recording_sid text,
  transcript text,
  extracted_data jsonb default '{}'::jsonb,
  transcription_status text default 'pending',
  started_at timestamp,
  ended_at timestamp,
  created_at timestamp not null default now()
);

create index if not exists idx_messages_conversation_id on messages(conversation_id);
create index if not exists idx_messages_timestamp on messages(timestamp);
create unique index if not exists idx_messages_external_source on messages(external_id, source);
create index if not exists idx_conversations_last_activity on conversations(last_activity);
create index if not exists idx_lead_assessments_conversation_id on lead_assessments(conversation_id);
create index if not exists idx_workflow_states_conversation_id on workflow_states(conversation_id);
create index if not exists idx_workflow_states_stage on workflow_states(stage);
create index if not exists idx_bookings_conversation_id on bookings(conversation_id);
create unique index if not exists idx_bookings_provider_external on bookings(provider, provider_booking_id);
create index if not exists idx_calls_conversation_id on calls(conversation_id);
create unique index if not exists idx_calls_call_sid on calls(call_sid);
