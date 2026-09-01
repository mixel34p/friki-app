CREATE TABLE custom_emojis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(space_id, name)
);

ALTER TABLE custom_emojis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los emojis son publicos"
ON custom_emojis FOR SELECT
TO public
USING (true);

CREATE POLICY "Admins pueden gestionar emojis"
ON custom_emojis FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM space_members
    WHERE space_members.space_id = custom_emojis.space_id
    AND space_members.user_id = auth.uid()
    AND space_members.role = 'admin'
  )
);
