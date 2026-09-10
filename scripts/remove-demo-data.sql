-- Manual cleanup for Task 9 demo records only. Shop2 and Shop3 intentionally remain.
begin;
do $$
begin
  if exists(select 1 from public.sales where sale_number ~ '^DEMO-SALE-0(0[1-9]|10)$' and notes is distinct from 'DEMO DATA — SAFE TO REMOVE') then
    raise exception 'A targeted sale is not marked as Task 9 demo data; cleanup aborted.';
  end if;
  if exists(select 1 from public.inventory_items where barcode ~ '^DEMO-(00[1-9]|01[0-9]|020)$' and notes is distinct from 'DEMO DATA — SAFE TO REMOVE') then
    raise exception 'A targeted inventory item is not marked as Task 9 demo data; cleanup aborted.';
  end if;

  delete from public.sale_items line using public.sales sale
  where line.sale_id=sale.id and sale.sale_number ~ '^DEMO-SALE-0(0[1-9]|10)$' and sale.notes='DEMO DATA — SAFE TO REMOVE';
  delete from public.sales where sale_number ~ '^DEMO-SALE-0(0[1-9]|10)$' and notes='DEMO DATA — SAFE TO REMOVE';
  delete from public.inventory_items where barcode ~ '^DEMO-(00[1-9]|01[0-9]|020)$' and notes='DEMO DATA — SAFE TO REMOVE';
end $$;
commit;
