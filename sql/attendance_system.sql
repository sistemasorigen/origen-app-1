-- ========================================================
-- ATTENDANCE SYSTEM SCHEMA
-- Run this in Supabase SQL Editor
-- ========================================================

-- Create group_attendance table
CREATE TABLE IF NOT EXISTS group_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  present_members JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, date)
);

-- Enable RLS
ALTER TABLE group_attendance ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can manage attendance
CREATE POLICY "Authenticated users can manage attendance" ON group_attendance 
  FOR ALL 
  USING (auth.role() = 'authenticated');

-- Grant access
GRANT ALL ON group_attendance TO authenticated;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_group_attendance_group_id ON group_attendance(group_id);
CREATE INDEX IF NOT EXISTS idx_group_attendance_date ON group_attendance(date DESC);

