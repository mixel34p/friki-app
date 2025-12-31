-- ═══════════════════════════════════════════════════════
-- GEEKSPHERE - SOCIAL DISCOVERY SYSTEM
-- Sistema de descubrimiento de usuarios sin presión social
-- ═══════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════
-- TABLA: user_visibility_settings
-- Configuración de visibilidad y límites del usuario
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_visibility_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    visibility_mode TEXT DEFAULT 'visible' CHECK (visibility_mode IN ('visible', 'affinity_only', 'invisible')),
    min_affinity_threshold INTEGER DEFAULT 50 CHECK (min_affinity_threshold >= 0 AND min_affinity_threshold <= 100),
    daily_request_limit INTEGER DEFAULT 5 CHECK (daily_request_limit >= 1 AND daily_request_limit <= 20),
    requests_sent_today INTEGER DEFAULT 0,
    last_request_reset DATE DEFAULT CURRENT_DATE,
    show_in_discovery BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsquedas de visibilidad
CREATE INDEX IF NOT EXISTS idx_visibility_mode ON user_visibility_settings(visibility_mode);

-- ═══════════════════════════════════════════════════════
-- TABLA: connection_requests
-- Solicitudes de contacto entre usuarios
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS connection_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    target_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    message TEXT CHECK (message IS NULL OR char_length(message) <= 200),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    affinity_score INTEGER DEFAULT 0,
    common_works_snapshot JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    UNIQUE(requester_id, target_id),
    CHECK (requester_id != target_id)
);

-- Índices para solicitudes
CREATE INDEX IF NOT EXISTS idx_connection_requests_requester ON connection_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_connection_requests_target ON connection_requests(target_id);
CREATE INDEX IF NOT EXISTS idx_connection_requests_status ON connection_requests(status);
CREATE INDEX IF NOT EXISTS idx_connection_requests_pending ON connection_requests(target_id, status) WHERE status = 'pending';

-- ═══════════════════════════════════════════════════════
-- TABLA: connections
-- Conexiones aceptadas (bidireccionales)
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user1_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    user2_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    common_works JSONB DEFAULT '[]'::jsonb,
    affinity_score INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- user1_id siempre menor que user2_id para evitar duplicados
    UNIQUE(user1_id, user2_id),
    CHECK (user1_id < user2_id)
);

-- Índices para conexiones
CREATE INDEX IF NOT EXISTS idx_connections_user1 ON connections(user1_id);
CREATE INDEX IF NOT EXISTS idx_connections_user2 ON connections(user2_id);

-- ═══════════════════════════════════════════════════════
-- TABLA: user_blocks
-- Bloqueos silenciosos
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_blocks (
    blocker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    blocked_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (blocker_id, blocked_id),
    CHECK (blocker_id != blocked_id)
);

-- Índices para bloqueos
CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON user_blocks(blocked_id);

-- ═══════════════════════════════════════════════════════
-- TABLA: chat_conversations
-- Conversaciones de chat
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID REFERENCES connections(id) ON DELETE CASCADE NOT NULL UNIQUE,
    last_message_at TIMESTAMPTZ,
    last_message_preview TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para ordenar por actividad reciente
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON chat_conversations(last_message_at DESC);

-- ═══════════════════════════════════════════════════════
-- TABLA: chat_messages
-- Mensajes de chat
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL CHECK (char_length(content) >= 1 AND char_length(content) <= 2000),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mensajes
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON chat_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON chat_messages(conversation_id, is_read) WHERE is_read = false;

-- ═══════════════════════════════════════════════════════
-- FUNCIONES
-- ═══════════════════════════════════════════════════════

-- Función para resetear el contador de solicitudes diarias
CREATE OR REPLACE FUNCTION reset_daily_request_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.last_request_reset < CURRENT_DATE THEN
        NEW.requests_sent_today := 0;
        NEW.last_request_reset := CURRENT_DATE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_visibility_settings_update ON user_visibility_settings;
CREATE TRIGGER on_visibility_settings_update
BEFORE UPDATE ON user_visibility_settings
FOR EACH ROW EXECUTE FUNCTION reset_daily_request_count();

-- Función para incrementar contador de solicitudes
CREATE OR REPLACE FUNCTION increment_request_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Resetear si es un nuevo día
    UPDATE user_visibility_settings
    SET 
        requests_sent_today = CASE 
            WHEN last_request_reset < CURRENT_DATE THEN 1
            ELSE requests_sent_today + 1
        END,
        last_request_reset = CURRENT_DATE
    WHERE user_id = NEW.requester_id;
    
    -- Crear settings si no existen
    INSERT INTO user_visibility_settings (user_id, requests_sent_today, last_request_reset)
    VALUES (NEW.requester_id, 1, CURRENT_DATE)
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_connection_request ON connection_requests;
CREATE TRIGGER on_connection_request
AFTER INSERT ON connection_requests
FOR EACH ROW EXECUTE FUNCTION increment_request_count();

-- Función para crear conexión cuando se acepta solicitud
CREATE OR REPLACE FUNCTION handle_connection_acceptance()
RETURNS TRIGGER AS $$
DECLARE
    u1 UUID;
    u2 UUID;
    new_connection_id UUID;
BEGIN
    IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
        -- Ordenar IDs para mantener constraint
        IF NEW.requester_id < NEW.target_id THEN
            u1 := NEW.requester_id;
            u2 := NEW.target_id;
        ELSE
            u1 := NEW.target_id;
            u2 := NEW.requester_id;
        END IF;
        
        -- Crear conexión
        INSERT INTO connections (user1_id, user2_id, affinity_score, common_works)
        VALUES (u1, u2, NEW.affinity_score, NEW.common_works_snapshot)
        ON CONFLICT (user1_id, user2_id) DO NOTHING
        RETURNING id INTO new_connection_id;
        
        -- Crear conversación si se creó la conexión
        IF new_connection_id IS NOT NULL THEN
            INSERT INTO chat_conversations (connection_id)
            VALUES (new_connection_id);
        END IF;
        
        -- Establecer fecha de respuesta
        NEW.responded_at := NOW();
    END IF;
    
    IF NEW.status = 'rejected' AND OLD.status = 'pending' THEN
        NEW.responded_at := NOW();
        -- NO enviamos notificación al rechazado (diseño intencionado)
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_request_status_change ON connection_requests;
CREATE TRIGGER on_request_status_change
BEFORE UPDATE OF status ON connection_requests
FOR EACH ROW EXECUTE FUNCTION handle_connection_acceptance();

-- Función para actualizar última actividad de conversación
CREATE OR REPLACE FUNCTION update_conversation_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_conversations
    SET 
        last_message_at = NEW.created_at,
        last_message_preview = LEFT(NEW.content, 100)
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_message ON chat_messages;
CREATE TRIGGER on_new_message
AFTER INSERT ON chat_messages
FOR EACH ROW EXECUTE FUNCTION update_conversation_activity();

-- Función para eliminar solicitudes cuando se bloquea usuario
CREATE OR REPLACE FUNCTION handle_user_block()
RETURNS TRIGGER AS $$
BEGIN
    -- Eliminar solicitudes pendientes en ambas direcciones
    DELETE FROM connection_requests 
    WHERE (requester_id = NEW.blocker_id AND target_id = NEW.blocked_id)
       OR (requester_id = NEW.blocked_id AND target_id = NEW.blocker_id);
    
    -- Eliminar conexión existente si la hay
    DELETE FROM connections
    WHERE (user1_id = LEAST(NEW.blocker_id, NEW.blocked_id) 
       AND user2_id = GREATEST(NEW.blocker_id, NEW.blocked_id));
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_block ON user_blocks;
CREATE TRIGGER on_user_block
AFTER INSERT ON user_blocks
FOR EACH ROW EXECUTE FUNCTION handle_user_block();

-- ═══════════════════════════════════════════════════════
-- FUNCIÓN: Calcular afinidad detallada entre dos usuarios
-- ═══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION calculate_user_affinity(user1 UUID, user2 UUID)
RETURNS TABLE (
    affinity_score INTEGER,
    common_works JSONB,
    matching_genres TEXT[],
    matching_platforms TEXT[]
) AS $$
DECLARE
    p1 RECORD;
    p2 RECORD;
    genre_matches TEXT[];
    platform_matches TEXT[];
    works_in_common JSONB;
    score INTEGER := 0;
    max_score INTEGER := 0;
BEGIN
    -- Obtener perfiles
    SELECT * INTO p1 FROM profiles WHERE user_id = user1;
    SELECT * INTO p2 FROM profiles WHERE user_id = user2;
    
    IF p1 IS NULL OR p2 IS NULL THEN
        RETURN QUERY SELECT 0::INTEGER, '[]'::JSONB, '{}'::TEXT[], '{}'::TEXT[];
        RETURN;
    END IF;
    
    -- Calcular géneros en común (20% peso)
    genre_matches := ARRAY(
        SELECT unnest(COALESCE(p1.favorite_genres, '{}')) 
        INTERSECT 
        SELECT unnest(COALESCE(p2.favorite_genres, '{}'))
    );
    score := score + (array_length(genre_matches, 1) * 10);
    max_score := max_score + (GREATEST(
        array_length(p1.favorite_genres, 1),
        array_length(p2.favorite_genres, 1),
        1
    ) * 10);
    
    -- Calcular plataformas en común (10% peso)
    platform_matches := ARRAY(
        SELECT unnest(COALESCE(p1.platforms, '{}')) 
        INTERSECT 
        SELECT unnest(COALESCE(p2.platforms, '{}'))
    );
    score := score + (array_length(platform_matches, 1) * 5);
    max_score := max_score + (GREATEST(
        array_length(p1.platforms, 1),
        array_length(p2.platforms, 1),
        1
    ) * 5);
    
    -- Era favorita (5% peso)
    IF p1.favorite_era = p2.favorite_era AND p1.favorite_era IS NOT NULL THEN
        score := score + 10;
    END IF;
    max_score := max_score + 10;
    
    -- Obras en común desde tierlists (40% peso)
    -- Buscar items que ambos usuarios tengan en tierlists
    WITH user1_items AS (
        SELECT DISTINCT ti.media_id, t.media_type
        FROM tierlist_items ti
        JOIN tierlists t ON t.id = ti.tierlist_id
        WHERE t.user_id = user1 AND ti.media_id IS NOT NULL
    ),
    user2_items AS (
        SELECT DISTINCT ti.media_id, t.media_type
        FROM tierlist_items ti
        JOIN tierlists t ON t.id = ti.tierlist_id
        WHERE t.user_id = user2 AND ti.media_id IS NOT NULL
    ),
    common AS (
        SELECT u1.media_id, u1.media_type
        FROM user1_items u1
        INNER JOIN user2_items u2 ON u1.media_id = u2.media_id AND u1.media_type = u2.media_type
        LIMIT 10
    )
    SELECT jsonb_agg(jsonb_build_object('media_id', media_id, 'media_type', media_type))
    INTO works_in_common
    FROM common;
    
    works_in_common := COALESCE(works_in_common, '[]'::jsonb);
    
    -- Añadir puntos por obras en común
    score := score + (jsonb_array_length(works_in_common) * 8);
    max_score := max_score + 80; -- Máximo 10 obras * 8 puntos
    
    -- Calcular porcentaje final
    IF max_score > 0 THEN
        affinity_score := ROUND((score::FLOAT / max_score::FLOAT) * 100)::INTEGER;
    ELSE
        affinity_score := 0;
    END IF;
    
    RETURN QUERY SELECT 
        LEAST(affinity_score, 100)::INTEGER,
        works_in_common,
        COALESCE(genre_matches, '{}'),
        COALESCE(platform_matches, '{}');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════

ALTER TABLE user_visibility_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- VISIBILITY SETTINGS policies
CREATE POLICY "Users can view own visibility settings"
    ON user_visibility_settings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own visibility settings"
    ON user_visibility_settings FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own visibility settings"
    ON user_visibility_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- CONNECTION REQUESTS policies
CREATE POLICY "Users can view their own requests"
    ON connection_requests FOR SELECT
    USING (auth.uid() = requester_id OR auth.uid() = target_id);

CREATE POLICY "Users can create requests"
    ON connection_requests FOR INSERT
    WITH CHECK (
        auth.uid() = requester_id
        AND NOT EXISTS (
            SELECT 1 FROM user_blocks 
            WHERE (blocker_id = target_id AND blocked_id = auth.uid())
               OR (blocker_id = auth.uid() AND blocked_id = target_id)
        )
    );

CREATE POLICY "Users can update requests they received"
    ON connection_requests FOR UPDATE
    USING (auth.uid() = target_id AND status = 'pending');

CREATE POLICY "Users can cancel their own pending requests"
    ON connection_requests FOR DELETE
    USING (auth.uid() = requester_id AND status = 'pending');

-- CONNECTIONS policies
CREATE POLICY "Users can view their connections"
    ON connections FOR SELECT
    USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- BLOCKS policies
CREATE POLICY "Users can view their blocks"
    ON user_blocks FOR SELECT
    USING (auth.uid() = blocker_id);

CREATE POLICY "Users can create blocks"
    ON user_blocks FOR INSERT
    WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can remove their blocks"
    ON user_blocks FOR DELETE
    USING (auth.uid() = blocker_id);

-- CHAT CONVERSATIONS policies
CREATE POLICY "Users can view their conversations"
    ON chat_conversations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM connections c
            WHERE c.id = connection_id
            AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        )
    );

-- CHAT MESSAGES policies
CREATE POLICY "Users can view messages in their conversations"
    ON chat_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM chat_conversations cc
            JOIN connections c ON c.id = cc.connection_id
            WHERE cc.id = conversation_id
            AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        )
    );

CREATE POLICY "Users can send messages in their conversations"
    ON chat_messages FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id
        AND EXISTS (
            SELECT 1 FROM chat_conversations cc
            JOIN connections c ON c.id = cc.connection_id
            WHERE cc.id = conversation_id
            AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        )
    );

CREATE POLICY "Users can mark messages as read"
    ON chat_messages FOR UPDATE
    USING (
        sender_id != auth.uid()
        AND EXISTS (
            SELECT 1 FROM chat_conversations cc
            JOIN connections c ON c.id = cc.connection_id
            WHERE cc.id = conversation_id
            AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        )
    );

-- ═══════════════════════════════════════════════════════
-- NOTIFICACIONES para conexiones aceptadas
-- ═══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION notify_connection_accepted()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
        -- Notificar al solicitante que fue aceptado
        INSERT INTO notifications (user_id, type, actor_id, resource_id)
        VALUES (NEW.requester_id, 'connection_accepted', NEW.target_id, NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_connection_accepted_notify ON connection_requests;
CREATE TRIGGER on_connection_accepted_notify
AFTER UPDATE OF status ON connection_requests
FOR EACH ROW EXECUTE FUNCTION notify_connection_accepted();
