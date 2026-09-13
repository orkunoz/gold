-- Owner-authorized pre-launch cleanup. Intentionally one-time and narrowly scoped.
do $$
declare v_inventory bigint;v_history bigint;v_sale_items bigint;v_sales bigint;
begin
 if not exists(select 1 from public.shops where location_type='WAREHOUSE') then raise exception 'Cleanup guard: Warehouse location is not configured.';end if;
 select count(*)into v_inventory from public.inventory_items;select count(*)into v_history from public.inventory_item_history;
 select count(*)into v_sale_items from public.sale_items;select count(*)into v_sales from public.sales;
 raise notice 'Pre-cleanup counts inventory=%, history=%, sale_items=%, sales=%',v_inventory,v_history,v_sale_items,v_sales;
 delete from public.inventory_item_history;delete from public.sale_items;delete from public.sales;alter table public.inventory_items disable trigger inventory_items_prevent_sold_mutation;delete from public.inventory_items;alter table public.inventory_items enable trigger inventory_items_prevent_sold_mutation;
 if exists(select 1 from public.inventory_items)or exists(select 1 from public.inventory_item_history)or exists(select 1 from public.sale_items)or exists(select 1 from public.sales)then raise exception 'Cleanup verification failed.';end if;
 raise notice 'Post-cleanup counts inventory=0, history=0, sale_items=0, sales=0';
end $$;
