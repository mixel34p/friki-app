-- Perfil: tipografías predefinidas para el nombre y la biografía.
-- Ejecutar una vez en el SQL Editor de Supabase.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS name_font text NOT NULL DEFAULT 'display',
    ADD COLUMN IF NOT EXISTS bio_font text NOT NULL DEFAULT 'sans';

ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_name_font_check,
    DROP CONSTRAINT IF EXISTS profiles_bio_font_check;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_name_font_check
        CHECK (name_font IN ('display', 'sans', 'system', 'humanist', 'rounded', 'serif', 'book', 'mono', 'condensed', 'pixel', 'gothic', 'handwriting')),
    ADD CONSTRAINT profiles_bio_font_check
        CHECK (bio_font IN ('inherit', 'display', 'sans', 'system', 'humanist', 'rounded', 'serif', 'book', 'mono', 'condensed', 'pixel', 'gothic', 'handwriting'));
