-- ═══════════════════════════════════════════════════════
-- GEEKSPHERE - CHAT FIXES
-- Relax constraints & UI support
-- ═══════════════════════════════════════════════════════

-- 1. Relax Content Constraint
-- Drop the existing check constraint that forces > 1 char
ALTER TABLE chat_messages
DROP CONSTRAINT IF EXISTS chat_messages_content_check;

-- Add new constraint: Content can be empty ONLY if image_url is present
ALTER TABLE chat_messages
ADD CONSTRAINT chat_messages_content_check 
CHECK (
    (char_length(content) >= 1) OR 
    (image_url IS NOT NULL AND char_length(image_url) > 0)
);

-- 2. Verify/Update Reaction RPC (Ensure it exists and works)
CREATE OR REPLACE FUNCTION toggle_message_reaction(
  p_message_id UUID,
  p_user_id UUID,
  p_emoji TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_reactions JSONB;
  v_user_list JSONB;
  v_new_list JSONB;
BEGIN
  -- Get current reactions
  SELECT reactions INTO v_reactions
  FROM chat_messages
  WHERE id = p_message_id;
  
  -- Initialize if null
  IF v_reactions IS NULL THEN
    v_reactions := '{}'::jsonb;
  END IF;
  
  -- Get list for this emoji
  v_user_list := v_reactions->p_emoji;
  
  IF v_user_list IS NULL THEN
    -- If emoji doesn't exist, create it with user
    v_reactions := jsonb_set(v_reactions, ARRAY[p_emoji], jsonb_build_array(p_user_id));
  ELSE
    -- Check if user exists in list
    IF v_user_list @> jsonb_build_array(p_user_id) THEN
      -- Remove user
      SELECT jsonb_agg(elem) INTO v_new_list
      FROM jsonb_array_elements(v_user_list) elem
      WHERE elem::text != ('"' || p_user_id || '"');
      
      IF v_new_list IS NULL THEN
        -- If list empty, remove key
        v_reactions := v_reactions - p_emoji;
      ELSE
         v_reactions := jsonb_set(v_reactions, ARRAY[p_emoji], v_new_list);
      END IF;
    ELSE
      -- Add user
      v_reactions := jsonb_set(v_reactions, ARRAY[p_emoji], v_user_list || jsonb_build_array(p_user_id));
    END IF;
  END IF;
  
  -- Update table
  UPDATE chat_messages
  SET reactions = v_reactions
  WHERE id = p_message_id;
  
  RETURN v_reactions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
