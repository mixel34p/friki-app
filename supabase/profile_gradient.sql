-- Add use_gradient column to profiles
alter table profiles
add column if not exists use_gradient boolean default false;
