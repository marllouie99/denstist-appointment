-- Google Calendar Integration Setup
-- Run this in your Supabase SQL Editor

-- Create table to store Google Calendar tokens for dentists
CREATE TABLE IF NOT EXISTS google_calendar_tokens (
  id SERIAL PRIMARY KEY,
  dentist_id UUID REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMP WITH TIME ZONE,
  scope TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(dentist_id)
);

-- Enable RLS
ALTER TABLE google_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Dentists can manage their own tokens" ON google_calendar_tokens
  FOR ALL USING (dentist_id = auth.uid());

-- Add updated_at trigger
CREATE TRIGGER update_google_calendar_tokens_updated_at 
  BEFORE UPDATE ON google_calendar_tokens 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add calendar_connected field to dentist_profile table
ALTER TABLE dentist_profile ADD COLUMN IF NOT EXISTS calendar_connected BOOLEAN DEFAULT false;

-- Function to check if dentist has valid Google Calendar token
CREATE OR REPLACE FUNCTION has_valid_calendar_token(dentist_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM google_calendar_tokens 
    WHERE dentist_id = dentist_uuid 
    AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
