-- Ejecutar después de add_profile_fonts.sql y de update_profile_fonts_pixel_gothic.sql.
-- Conserva los valores existentes y habilita la nueva familia manuscrita.
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_name_font_check,
    DROP CONSTRAINT IF EXISTS profiles_bio_font_check;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_name_font_check
        CHECK (name_font IN ('display', 'sans', 'system', 'humanist', 'rounded', 'serif', 'book', 'mono', 'condensed', 'pixel', 'gothic', 'handwriting')),
    ADD CONSTRAINT profiles_bio_font_check
        CHECK (bio_font IN ('inherit', 'display', 'sans', 'system', 'humanist', 'rounded', 'serif', 'book', 'mono', 'condensed', 'pixel', 'gothic', 'handwriting'));
