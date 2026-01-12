-- Migration: Add calls table and job_value to bookings
-- Run this migration to add call recording/transcription support and job value tracking

-- Add job_value column to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS job_value decimal(10,2);

-- Create calls table for call recordings and transcriptions
CREATE TABLE IF NOT EXISTS calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  call_sid text UNIQUE,
  direction text NOT NULL,
  status text,
  duration_seconds integer,
  recording_url text,
  recording_sid text,
  transcript text,
  extracted_data jsonb DEFAULT '{}'::jsonb,
  transcription_status text DEFAULT 'pending',
  started_at timestamp,
  ended_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

-- Create indexes for calls table
CREATE INDEX IF NOT EXISTS idx_calls_conversation_id ON calls(conversation_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_calls_call_sid ON calls(call_sid);

-- Add comment for documentation
COMMENT ON TABLE calls IS 'Stores call recordings and AI-extracted transcriptions';
COMMENT ON COLUMN calls.extracted_data IS 'AI-extracted data: address, city, vehicle info, notes, etc.';
COMMENT ON COLUMN calls.transcription_status IS 'Status: pending, processing, completed, failed';
COMMENT ON COLUMN bookings.job_value IS 'Actual revenue from this job, used for commission calculation (9%)';
