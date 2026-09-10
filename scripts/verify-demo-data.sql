-- Read-only assertions for the exact Task 9 demo dataset.
do $$
begin
  if (select count(*) from public.shops where code in ('SHOP2','SHOP3') and is_active)<>2 then raise exception 'Shop2/Shop3 are not both active.'; end if;
  if (select count(*) from public.inventory_items where barcode ~ '^DEMO-(00[1-9]|01[0-9]|020)$' and notes='DEMO DATA — SAFE TO REMOVE')<>20 then raise exception 'Expected 20 exact demo inventory rows.'; end if;
  if (select count(distinct barcode) from public.inventory_items where barcode ~ '^DEMO-(00[1-9]|01[0-9]|020)$' and notes='DEMO DATA — SAFE TO REMOVE')<>20 then raise exception 'Demo barcodes are not unique.'; end if;
  if (select count(*) from public.inventory_items where barcode ~ '^DEMO-(00[1-9]|01[0-9]|020)$' and notes='DEMO DATA — SAFE TO REMOVE' and status='SOLD')<>10 then raise exception 'Expected 10 SOLD demo items.'; end if;
  if (select count(*) from public.inventory_items where barcode ~ '^DEMO-(00[1-9]|01[0-9]|020)$' and notes='DEMO DATA — SAFE TO REMOVE' and status='IN_STOCK')<>10 then raise exception 'Expected 10 IN_STOCK demo items.'; end if;
  if (select count(*) from public.sales where sale_number ~ '^DEMO-SALE-0(0[1-9]|10)$' and notes='DEMO DATA — SAFE TO REMOVE')<>10 then raise exception 'Expected 10 demo sales.'; end if;
  if exists(select 1 from public.sales sale where sale.sale_number ~ '^DEMO-SALE-0(0[1-9]|10)$' and sale.notes='DEMO DATA — SAFE TO REMOVE' and (select count(*) from public.sale_items where sale_id=sale.id)<>1) then raise exception 'Demo sale line count is invalid.'; end if;
  if exists(select 1 from public.sales sale where sale.sale_number ~ '^DEMO-SALE-0(0[1-9]|10)$' and sale.notes='DEMO DATA — SAFE TO REMOVE' and (sale.total_sale_price<>(select sum(sale_price) from public.sale_items where sale_id=sale.id) or sale.total_list_price is distinct from (select sum(list_price) from public.sale_items where sale_id=sale.id))) then raise exception 'Demo totals do not equal line snapshots.'; end if;
end $$;
