-- ═══════════════════════════════════════════════════════
-- MICRO-INTERACCIONES DIARIAS - MIGRATION
-- ═══════════════════════════════════════════════════════

-- Daily Prompts Table (Votaciones y Preguntas Diarias)
CREATE TABLE daily_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('poll', 'question')),
  content TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  media_type TEXT CHECK (media_type IN ('game', 'anime', 'character', 'general')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, type)
);

-- Daily Responses Table (Respuestas de Usuarios)
CREATE TABLE daily_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  prompt_id UUID REFERENCES daily_prompts(id) ON DELETE CASCADE NOT NULL,
  answer JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, prompt_id)
);

-- Thematic Reactions Table (Reacciones Temáticas)
CREATE TABLE thematic_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('tierlist', 'debate', 'review')),
  target_id UUID NOT NULL,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('epic', 'interesting', 'meh', 'destroyed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, target_type, target_id)
);

-- Indexes
CREATE INDEX idx_daily_prompts_date ON daily_prompts(date DESC);
CREATE INDEX idx_daily_prompts_type ON daily_prompts(type);
CREATE INDEX idx_daily_responses_user ON daily_responses(user_id);
CREATE INDEX idx_daily_responses_prompt ON daily_responses(prompt_id);
CREATE INDEX idx_thematic_reactions_target ON thematic_reactions(target_type, target_id);
CREATE INDEX idx_thematic_reactions_user ON thematic_reactions(user_id);

-- Enable Row Level Security
ALTER TABLE daily_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE thematic_reactions ENABLE ROW LEVEL SECURITY;

-- Policies for daily_prompts (todos pueden ver)
CREATE POLICY "Daily prompts are viewable by everyone" 
  ON daily_prompts FOR SELECT 
  USING (true);

CREATE POLICY "Only authenticated users can create prompts" 
  ON daily_prompts FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

-- Policies for daily_responses (privadas, solo agregados)
CREATE POLICY "Users can view own responses" 
  ON daily_responses FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own responses" 
  ON daily_responses FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own responses" 
  ON daily_responses FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own responses" 
  ON daily_responses FOR DELETE 
  USING (auth.uid() = user_id);

-- Policies for thematic_reactions
CREATE POLICY "Reactions are viewable by everyone" 
  ON thematic_reactions FOR SELECT 
  USING (true);

CREATE POLICY "Users can create own reactions" 
  ON thematic_reactions FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reactions" 
  ON thematic_reactions FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reactions" 
  ON thematic_reactions FOR DELETE 
  USING (auth.uid() = user_id);

-- Function to get aggregated poll results (sin exponer usuarios)
CREATE OR REPLACE FUNCTION get_poll_results(poll_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  total_votes INT;
BEGIN
  -- Count total votes
  SELECT COUNT(*) INTO total_votes
  FROM daily_responses
  WHERE prompt_id = poll_id;

  -- Get vote distribution
  SELECT jsonb_object_agg(
    answer->>'choice',
    jsonb_build_object(
      'count', count,
      'percentage', ROUND((count::numeric / NULLIF(total_votes, 0)) * 100, 1)
    )
  ) INTO result
  FROM (
    SELECT 
      answer->>'choice' as choice,
      COUNT(*)::int as count
    FROM daily_responses
    WHERE prompt_id = poll_id
    GROUP BY answer->>'choice'
  ) subq;

  RETURN jsonb_build_object(
    'total', total_votes,
    'distribution', COALESCE(result, '{}'::jsonb)
  );
END;
$$;

-- Function to get reaction counts for content
CREATE OR REPLACE FUNCTION get_reaction_counts(p_target_type TEXT, p_target_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_object_agg(reaction_type, count)
  INTO result
  FROM (
    SELECT 
      reaction_type,
      COUNT(*)::int as count
    FROM thematic_reactions
    WHERE target_type = p_target_type AND target_id = p_target_id
    GROUP BY reaction_type
  ) subq;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- Insert some example daily prompts for testing
INSERT INTO daily_prompts (type, content, options, media_type, date) VALUES
(
  'poll',
  '¿Cuál prefieres hoy?',
  '[
    {"id": "option1", "label": "Hollow Knight", "image": "https://images.igdb.com/igdb/image/upload/t_cover_big/co1rgi.png"},
    {"id": "option2", "label": "Celeste", "image": "https://images.igdb.com/igdb/image/upload/t_cover_big/co1tmu.png"}
  ]'::jsonb,
  'game',
  CURRENT_DATE
),
(
  'question',
  '¿Juego que todo el mundo ama y tú no?',
  '[]'::jsonb,
  'game',
  CURRENT_DATE
);

COMMENT ON TABLE daily_prompts IS 'Prompts diarios: votaciones y preguntas para micro-interacciones';
COMMENT ON TABLE daily_responses IS 'Respuestas de usuarios a prompts (privadas, solo agregados visibles)';
COMMENT ON TABLE thematic_reactions IS 'Reacciones temáticas a contenido (tierlists, debates, reviews)';
