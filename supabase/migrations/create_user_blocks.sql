-- Create user_blocks table for blocking/unblocking users
-- Run this in Supabase SQL Editor

-- FIRST: Drop the old table if it exists with wrong constraints
DROP TABLE IF EXISTS user_blocks;

-- Recreate with references to profiles instead of auth.users
CREATE TABLE user_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id)
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id);

-- Enable Row Level Security
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

-- RLS Policies:
-- 1. Users can see their own blocks (both as blocker and blocked)
CREATE POLICY "Users can view their own blocks"
ON user_blocks FOR SELECT
TO authenticated
USING (
    auth.uid() = blocker_id OR auth.uid() = blocked_id
);

-- 2. Users can insert blocks (block someone)
CREATE POLICY "Users can block others"
ON user_blocks FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = blocker_id
);

-- 3. Users can delete their own blocks (unblock)
CREATE POLICY "Users can unblock"
ON user_blocks FOR DELETE
TO authenticated
USING (
    auth.uid() = blocker_id
);
