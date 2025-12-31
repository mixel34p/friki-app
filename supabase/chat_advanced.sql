-- ═══════════════════════════════════════════════════════
-- CHAT ADVANCED FEATURES - Message Edit/Delete Support
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- Add edited_at column to track when messages are edited
ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

-- Add RLS policy to allow users to update their own messages
DROP POLICY IF EXISTS "Users can update own messages" ON chat_messages;
CREATE POLICY "Users can update own messages" ON chat_messages
FOR UPDATE USING (auth.uid() = sender_id);

-- Add RLS policy to allow users to delete their own messages
DROP POLICY IF EXISTS "Users can delete own messages" ON chat_messages;
CREATE POLICY "Users can delete own messages" ON chat_messages
FOR DELETE USING (auth.uid() = sender_id);
