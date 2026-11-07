-- Priced, multi-selectable add-ons per menu item (e.g. Extra Shot, Oat Milk).
-- Mirrors the existing `variants` jsonb column; each entry is { name, price }.
alter table public.menu_items
  add column if not exists modifiers jsonb not null default '[]'::jsonb;
