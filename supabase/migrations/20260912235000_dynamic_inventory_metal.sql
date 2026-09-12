-- Metal and producer are open, nullable inventory text fields.
-- Dropping this CHECK changes no existing product rows.
alter table public.inventory_items
  drop constraint if exists inventory_metal_allowed;

comment on column public.inventory_items.metal is
  'Optional open-text metal value supplied by inventory users or imports.';

comment on column public.inventory_items.producer is
  'Optional open-text producer value supplied by inventory users or imports.';
