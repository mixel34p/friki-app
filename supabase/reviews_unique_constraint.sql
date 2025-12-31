-- Add unique constraint to prevent multiple reviews per user per work
ALTER TABLE reviews
ADD CONSTRAINT reviews_user_work_unique UNIQUE (user_id, work_id, work_type);

-- Policy to ensure users can only update their own review (already exists usually, but good to verify update logic if we allow editing later)
-- For now, the constraint handles the 'one review' rule at DB level.
