-- Trigger for Tierlist Likes
CREATE OR REPLACE FUNCTION handle_new_like()
RETURNS TRIGGER AS $$
DECLARE
  tierlist_owner_id UUID;
BEGIN
  -- Get tierlist owner
  SELECT user_id INTO tierlist_owner_id FROM tierlists WHERE id = NEW.tierlist_id;

  -- Verify existence and not self-like
  IF tierlist_owner_id IS NOT NULL AND tierlist_owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, actor_id, resource_id)
    VALUES (tierlist_owner_id, 'like', NEW.user_id, NEW.tierlist_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_like_created ON tierlist_likes;
CREATE TRIGGER on_like_created
  AFTER INSERT ON tierlist_likes
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_like();

-- Trigger for Tierlist Comments
CREATE OR REPLACE FUNCTION handle_new_comment()
RETURNS TRIGGER AS $$
DECLARE
  tierlist_owner_id UUID;
BEGIN
  -- Get tierlist owner
  SELECT user_id INTO tierlist_owner_id FROM tierlists WHERE id = NEW.tierlist_id;

  -- Verify existence and not self-comment
  IF tierlist_owner_id IS NOT NULL AND tierlist_owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, actor_id, resource_id)
    VALUES (tierlist_owner_id, 'comment', NEW.user_id, NEW.tierlist_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_comment_created ON tierlist_comments;
CREATE TRIGGER on_comment_created
  AFTER INSERT ON tierlist_comments
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_comment();
