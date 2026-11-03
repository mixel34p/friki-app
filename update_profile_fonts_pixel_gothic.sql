-- Actualiza la migración add_profile_fonts.sql ya aplicada.
-- Permite las nuevas familias sin modificar los valores actuales de los perfiles.
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_name_font_check,
    DROP CONSTRAINT IF EXISTS profiles_bio_font_check;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_name_font_check
        CHECK (name_font IN ('display', 'sans', 'system', 'humanist', 'rounded', 'serif', 'book', 'mono', 'condensed', 'pixel', 'gothic')),
    ADD CONSTRAINT profiles_bio_font_check
        CHECK (bio_font IN ('inherit', 'display', 'sans', 'system', 'humanist', 'rounded', 'serif', 'book', 'mono', 'condensed', 'pixel', 'gothic'));
