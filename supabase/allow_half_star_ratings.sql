-- Permite guardar valoraciones en pasos de media estrella (0,5 a 5).
-- La restricción anterior de library_entries impedía insertar estos valores.
begin;

alter table public.library_entries
    drop constraint if exists library_entries_rating_check;

alter table public.library_entries
    alter column rating type numeric(2, 1)
    using rating::numeric(2, 1);

alter table public.library_entries
    add constraint library_entries_rating_check
    check (
        rating is null
        or (rating >= 0.5 and rating <= 5 and rating * 2 = trunc(rating * 2))
    );

commit;
