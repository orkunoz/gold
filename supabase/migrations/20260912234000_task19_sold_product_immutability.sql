-- SOLD inventory is immutable after complete_sale records its historical snapshots.
-- The transition into SOLD remains valid; every later UPDATE or DELETE is rejected.
create or replace function public.prevent_sold_inventory_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'SOLD' then
    raise exception using
      errcode = '22023',
      message = 'SOLD products are immutable and cannot be edited or deleted.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

drop trigger if exists inventory_items_prevent_sold_mutation on public.inventory_items;
create trigger inventory_items_prevent_sold_mutation
before update or delete on public.inventory_items
for each row execute function public.prevent_sold_inventory_mutation();

comment on function public.prevent_sold_inventory_mutation() is
  'Rejects every update or deletion after an inventory item has reached SOLD; complete_sale may still transition IN_STOCK to SOLD.';
