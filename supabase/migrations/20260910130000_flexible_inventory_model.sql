-- Task 10: nullable, mapping-driven inventory source fields.
alter table public.inventory_items alter column barcode drop not null;
alter table public.inventory_items add column metal text;
alter table public.inventory_items add column producer text;
alter table public.inventory_items add column price_per_gram numeric(14,2);
alter table public.inventory_items add column price numeric(14,2);
alter table public.inventory_items add column discount text;

alter table public.inventory_items add constraint inventory_metal_allowed
  check (metal is null or metal in ('Gold','Silver'));
alter table public.inventory_items add constraint inventory_producer_not_empty
  check (producer is null or btrim(producer)<>'');
alter table public.inventory_items add constraint inventory_price_per_gram_nonnegative
  check (price_per_gram is null or price_per_gram>=0);
alter table public.inventory_items add constraint inventory_price_nonnegative
  check (price is null or price>=0);
alter table public.inventory_items add constraint inventory_discount_not_empty
  check (discount is null or btrim(discount)<>'');

create index inventory_items_metal_idx on public.inventory_items(metal) where metal is not null;

comment on column public.inventory_items.price is 'Imported/source inventory price; separate from owner_price, selling_price, effective pricing, and historical sale snapshots.';
comment on column public.inventory_items.discount is 'Imported/source discount information only; does not alter effective customer pricing.';
comment on column public.inventory_items.barcode is 'Optional scanner identifier; non-null values remain globally unique and trimmed.';
