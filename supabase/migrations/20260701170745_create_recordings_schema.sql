/*
# VocalVoice: Create recordings schema

## Summary
Sets up the database and storage infrastructure for the VocalVoice voice recording app.

## New Tables
- `recordings`
  - `id` (uuid, primary key, auto-generated)
  - `title` (text, not null) — user-provided name for the recording
  - `duration_seconds` (integer, not null, default 0) — length of the audio clip
  - `storage_path` (text, not null) — filename in the voice-recordings storage bucket
  - `created_at` (timestamptz, default now()) — when the recording was made

## Storage
- Creates a public `voice-recordings` bucket to store audio .webm files
- RLS policies on storage.objects allow anon + authenticated access

## Security
- RLS is enabled on `recordings`
- Single-tenant app (no sign-in), so policies use `TO anon, authenticated` with `USING (true)`
  — the data is intentionally shared/public within this app instance

## Notes
1. This is a single-tenant app; no user_id column or auth.uid() checks needed
2. Storage bucket is public so audio URLs can be used directly in <audio> elements
3. All policies are idempotent (DROP IF EXISTS before CREATE)
*/

CREATE TABLE IF NOT EXISTS recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 0,
  storage_path text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_recordings" ON recordings;
CREATE POLICY "anon_select_recordings" ON recordings FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_recordings" ON recordings;
CREATE POLICY "anon_insert_recordings" ON recordings FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_recordings" ON recordings;
CREATE POLICY "anon_update_recordings" ON recordings FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_recordings" ON recordings;
CREATE POLICY "anon_delete_recordings" ON recordings FOR DELETE
TO anon, authenticated USING (true);

-- Create storage bucket for audio files
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-recordings', 'voice-recordings', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
DROP POLICY IF EXISTS "anon_select_voice_recordings" ON storage.objects;
CREATE POLICY "anon_select_voice_recordings" ON storage.objects FOR SELECT
TO anon, authenticated USING (bucket_id = 'voice-recordings');

DROP POLICY IF EXISTS "anon_insert_voice_recordings" ON storage.objects;
CREATE POLICY "anon_insert_voice_recordings" ON storage.objects FOR INSERT
TO anon, authenticated WITH CHECK (bucket_id = 'voice-recordings');

DROP POLICY IF EXISTS "anon_delete_voice_recordings" ON storage.objects;
CREATE POLICY "anon_delete_voice_recordings" ON storage.objects FOR DELETE
TO anon, authenticated USING (bucket_id = 'voice-recordings');
