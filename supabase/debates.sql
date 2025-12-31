-- ═══════════════════════════════════════════════════════
-- GEEKSPHERE - DEBATE/FORUM SYSTEM
-- Sistema de debates tipo foro para obras (games/anime)
-- ═══════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════
-- TABLA: debates
-- Hilo principal de debate
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS debates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL CHECK (char_length(title) >= 5 AND char_length(title) <= 150),
    content TEXT NOT NULL CHECK (char_length(content) >= 20 AND char_length(content) <= 5000),
    debate_type TEXT DEFAULT 'opinion' CHECK (debate_type IN ('opinion', 'comparison', 'question', 'ranking')),
    is_pinned BOOLEAN DEFAULT false,
    is_locked BOOLEAN DEFAULT false,
    posts_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para debates
CREATE INDEX IF NOT EXISTS idx_debates_user ON debates(user_id);
CREATE INDEX IF NOT EXISTS idx_debates_created ON debates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_debates_type ON debates(debate_type);
CREATE INDEX IF NOT EXISTS idx_debates_pinned ON debates(is_pinned) WHERE is_pinned = true;

-- ═══════════════════════════════════════════════════════
-- TABLA: debate_media
-- Relación debate ↔ obras (games/anime)
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS debate_media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    debate_id UUID REFERENCES debates(id) ON DELETE CASCADE NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('game', 'anime')),
    media_id BIGINT NOT NULL,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(debate_id, media_type, media_id)
);

-- Índices para debate_media
CREATE INDEX IF NOT EXISTS idx_debate_media_debate ON debate_media(debate_id);
CREATE INDEX IF NOT EXISTS idx_debate_media_game ON debate_media(media_id) WHERE media_type = 'game';
CREATE INDEX IF NOT EXISTS idx_debate_media_anime ON debate_media(media_id) WHERE media_type = 'anime';

-- ═══════════════════════════════════════════════════════
-- TABLA: debate_posts
-- Respuestas/posts en los debates
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS debate_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    debate_id UUID REFERENCES debates(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 3000),
    quoted_post_id UUID REFERENCES debate_posts(id) ON DELETE SET NULL,
    mentioned_media_type TEXT CHECK (mentioned_media_type IS NULL OR mentioned_media_type IN ('game', 'anime')),
    mentioned_media_id BIGINT,
    reaction_score INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para debate_posts
CREATE INDEX IF NOT EXISTS idx_debate_posts_debate ON debate_posts(debate_id);
CREATE INDEX IF NOT EXISTS idx_debate_posts_user ON debate_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_debate_posts_created ON debate_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_debate_posts_score ON debate_posts(reaction_score DESC);

-- ═══════════════════════════════════════════════════════
-- TABLA: debate_reactions
-- Reacciones cualitativas a posts
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS debate_reactions (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    post_id UUID REFERENCES debate_posts(id) ON DELETE CASCADE NOT NULL,
    reaction_type TEXT NOT NULL CHECK (reaction_type IN ('good_argument', 'interesting', 'strong_opinion')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, post_id)
);

-- Índices para debate_reactions
CREATE INDEX IF NOT EXISTS idx_debate_reactions_post ON debate_reactions(post_id);

-- ═══════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════

-- Trigger para actualizar posts_count en debates
CREATE OR REPLACE FUNCTION update_debate_posts_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE debates SET posts_count = posts_count + 1, updated_at = NOW() WHERE id = NEW.debate_id;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE debates SET posts_count = posts_count - 1 WHERE id = OLD.debate_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_debate_post_change ON debate_posts;
CREATE TRIGGER on_debate_post_change
AFTER INSERT OR DELETE ON debate_posts
FOR EACH ROW EXECUTE FUNCTION update_debate_posts_count();

-- Trigger para actualizar reaction_score en posts
CREATE OR REPLACE FUNCTION update_post_reaction_score()
RETURNS TRIGGER AS $$
DECLARE
    score_delta INTEGER;
BEGIN
    -- Peso de cada reacción
    CASE 
        WHEN TG_OP = 'INSERT' THEN
            CASE NEW.reaction_type
                WHEN 'good_argument' THEN score_delta := 3;
                WHEN 'interesting' THEN score_delta := 2;
                WHEN 'strong_opinion' THEN score_delta := 1;
                ELSE score_delta := 1;
            END CASE;
            UPDATE debate_posts SET reaction_score = reaction_score + score_delta WHERE id = NEW.post_id;
            RETURN NEW;
        WHEN TG_OP = 'DELETE' THEN
            CASE OLD.reaction_type
                WHEN 'good_argument' THEN score_delta := 3;
                WHEN 'interesting' THEN score_delta := 2;
                WHEN 'strong_opinion' THEN score_delta := 1;
                ELSE score_delta := 1;
            END CASE;
            UPDATE debate_posts SET reaction_score = reaction_score - score_delta WHERE id = OLD.post_id;
            RETURN OLD;
    END CASE;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_debate_reaction_change ON debate_reactions;
CREATE TRIGGER on_debate_reaction_change
AFTER INSERT OR DELETE ON debate_reactions
FOR EACH ROW EXECUTE FUNCTION update_post_reaction_score();

-- ═══════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════

-- Enable RLS
ALTER TABLE debates ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_reactions ENABLE ROW LEVEL SECURITY;

-- DEBATES policies
CREATE POLICY "Debates are viewable by everyone" 
    ON debates FOR SELECT USING (true);

CREATE POLICY "Users can create debates" 
    ON debates FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own debates" 
    ON debates FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own debates" 
    ON debates FOR DELETE 
    USING (auth.uid() = user_id);

-- DEBATE_MEDIA policies
CREATE POLICY "Debate media viewable by everyone" 
    ON debate_media FOR SELECT USING (true);

CREATE POLICY "Users can add media to own debates" 
    ON debate_media FOR INSERT 
    WITH CHECK (
        EXISTS (SELECT 1 FROM debates WHERE id = debate_id AND user_id = auth.uid())
    );

CREATE POLICY "Users can remove media from own debates" 
    ON debate_media FOR DELETE 
    USING (
        EXISTS (SELECT 1 FROM debates WHERE id = debate_id AND user_id = auth.uid())
    );

-- DEBATE_POSTS policies
CREATE POLICY "Posts are viewable by everyone" 
    ON debate_posts FOR SELECT USING (true);

CREATE POLICY "Users can create posts" 
    ON debate_posts FOR INSERT 
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (SELECT 1 FROM debates WHERE id = debate_id AND is_locked = false)
    );

CREATE POLICY "Users can update own posts" 
    ON debate_posts FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts" 
    ON debate_posts FOR DELETE 
    USING (auth.uid() = user_id);

-- Debate owner can also delete posts
CREATE POLICY "Debate owners can delete any post" 
    ON debate_posts FOR DELETE 
    USING (
        EXISTS (SELECT 1 FROM debates WHERE id = debate_id AND user_id = auth.uid())
    );

-- DEBATE_REACTIONS policies
CREATE POLICY "Reactions are viewable by everyone" 
    ON debate_reactions FOR SELECT USING (true);

CREATE POLICY "Users can add reactions" 
    ON debate_reactions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own reactions" 
    ON debate_reactions FOR DELETE 
    USING (auth.uid() = user_id);
