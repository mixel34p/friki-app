-- Semilla de Prompts Diarios para las próximas semanas
-- CORREGIDO: Usa $$ para JSON y [] para options vacías

-- Limpiar prompts futuros
DELETE FROM daily_prompts WHERE date >= CURRENT_DATE;

-- DÍA 1: El Clásico RPG (Juegos por ID)
INSERT INTO daily_prompts (type, content, options, media_type, date)
VALUES (
  'poll',
  '¿Cuál es el rey de los RPGs de mundo abierto?',
  $$[
    {"id": "119277", "type": "game"}, 
    {"id": "7346", "type": "game"}
  ]$$::jsonb,
  'game',
  CURRENT_DATE
);

-- DÍA 2: Pregunta abierta Friki (Options vacío en lugar de NULL)
INSERT INTO daily_prompts (type, content, options, media_type, date)
VALUES (
  'question',
  'Si pudieras vivir en cualquier mundo de anime, ¿cuál elegirías y por qué?',
  '[]'::jsonb,
  null,
  CURRENT_DATE + 1
);

-- DÍA 3: Shonen Titan (Anime por ID)
INSERT INTO daily_prompts (type, content, options, media_type, date)
VALUES (
  'poll',
  '¿Cuál te marcó más?',
  $$[
    {"id": "5114", "type": "anime"}, 
    {"id": "16498", "type": "anime"}
  ]$$::jsonb,
  'anime',
  CURRENT_DATE + 2
);

-- DÍA 4: Estilo de juego
INSERT INTO daily_prompts (type, content, options, media_type, date)
VALUES (
  'poll',
  'Para un Shooter Competitivo, ¿tienes que usar...?',
  $$[
    {"id": "kb", "label": "Teclado y Ratón", "image": "https://images.unsplash.com/photo-1587829745563-04b1f29244eb?auto=format&fit=crop&w=500&q=80"},
    {"id": "controller", "label": "Mando / Control", "image": "https://images.unsplash.com/photo-1593508512255-86ab42a8e620?auto=format&fit=crop&w=500&q=80"}
  ]$$::jsonb,
  null,
  CURRENT_DATE + 3
);

-- DÍA 5: Indie Joyas
INSERT INTO daily_prompts (type, content, options, media_type, date)
VALUES (
  'poll',
  'Mejor Indie de la década',
  $$[
    {"id": "19164", "type": "game"}, 
    {"id": "121", "type": "game"}
  ]$$::jsonb,
  'game',
  CURRENT_DATE + 4
);

-- DÍA 6: Pregunta Polémica
INSERT INTO daily_prompts (type, content, options, media_type, date)
VALUES (
  'question',
  'Di una opinión sobre videojuegos que te pondría una espada en el cuello (Hot Take).',
  '[]'::jsonb,
  null,
  CURRENT_DATE + 5
);

-- DÍA 7: La eterna batalla
INSERT INTO daily_prompts (type, content, options, media_type, date)
VALUES (
  'poll',
  'Crimen y Caos: ¿Cuál prefieres?',
  $$[
    {"id": "1020", "type": "game"}, 
    {"id": "2942", "type": "game"}
  ]$$::jsonb,
  'game',
  CURRENT_DATE + 6
);

-- DÍA 8: Anime Reciente
INSERT INTO daily_prompts (type, content, options, media_type, date)
VALUES (
  'poll',
  'Fantasía Moderna vs Clásica',
  $$[
    {"id": "52991", "type": "anime"},
    {"id": "21", "type": "anime"}
  ]$$::jsonb,
  'anime',
  CURRENT_DATE + 7
);

-- DÍA 9: Plataformas
INSERT INTO daily_prompts (type, content, options, media_type, date)
VALUES (
  'poll',
  '¿Formato Físico o Digital?',
  $$[
    {"id": "phys", "label": "Físico (Cajita)", "image": "https://images.unsplash.com/photo-1629759325791-c422aa98006e?auto=format&fit=crop&w=500&q=80"},
    {"id": "digi", "label": "Digital (Steam/Store)", "image": "https://images.unsplash.com/photo-1616499370260-485b3e5ed653?auto=format&fit=crop&w=500&q=80"}
  ]$$::jsonb,
  null,
  CURRENT_DATE + 8
);

-- DÍA 10: Pregunta Nostalgia
INSERT INTO daily_prompts (type, content, options, media_type, date)
VALUES (
  'question',
  '¿Cuál fue el primer videojuego que completaste al 100%?',
  '[]'::jsonb,
  null,
  CURRENT_DATE + 9
);

-- DÍA 11: JRPG Classics
INSERT INTO daily_prompts (type, content, options, media_type, date)
VALUES (
  'poll',
  'JRPG Estiloso',
  $$[
    {"id": "11422", "type": "game"}, 
    {"id": "26226", "type": "game"}
  ]$$::jsonb,
  'game',
  CURRENT_DATE + 10
);

-- DÍA 12: Superhéroes
INSERT INTO daily_prompts (type, content, options, media_type, date)
VALUES (
  'poll',
  'Héroes en Entrenamiento',
  $$[
    {"id": "31964", "type": "anime"},
    {"id": "30276", "type": "anime"}
  ]$$::jsonb,
  'anime',
  CURRENT_DATE + 11
);

-- DÍA 13: Pregunta Comunidad
INSERT INTO daily_prompts (type, content, options, media_type, date)
VALUES (
  'question',
  'Recomienda un juego/anime infravalorado que casi nadie conoce.',
  '[]'::jsonb,
  null,
  CURRENT_DATE + 12
);

-- DÍA 14: Final Boss
INSERT INTO daily_prompts (type, content, options, media_type, date)
VALUES (
  'poll',
  'Dificultad en juegos',
  $$[
    {"id": "hard", "label": "Dame un desafío (Souls-like)", "image": "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=500&q=80"},
    {"id": "story", "label": "Quiero disfrutar la historia", "image": "https://images.unsplash.com/photo-1519669556878-63bd08be7690?auto=format&fit=crop&w=500&q=80"}
  ]$$::jsonb,
  null,
  CURRENT_DATE + 13
);

-- Output para confirmar
SELECT date, type, content FROM daily_prompts WHERE date >= CURRENT_DATE ORDER BY date ASC;
