-- Run in Supabase SQL Editor
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS dashboard_profile TEXT DEFAULT 'executive';
