-- Owner-only atomic creation for the manual draft-basket workflow.
create or replace function public.create_inventory_items_batch(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_employee public.employees%rowtype;
  v_warehouse uuid;
  v_item jsonb;
  v_row integer := 0;
  v_barcode text;
begin
  v_employee := public.require_owner_employee();
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then
    raise exception using errcode = '22023', message = 'Batch must contain 1 to 100 products.';
  end if;
  select id into v_warehouse from public.shops where location_type = 'WAREHOUSE' and is_active;
  if v_warehouse is null then raise exception using errcode = '22023', message = 'Active Warehouse location is not configured.'; end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_row := v_row + 1;
    v_barcode := nullif(btrim(v_item->>'barcode'), '');
    if v_barcode is not null and exists(select 1 from public.inventory_items where barcode = v_barcode) then
      raise exception using errcode = '23505', message = format('Row %s: barcode %s already exists.', v_row, v_barcode);
    end if;
    begin
      insert into public.inventory_items(
        shop_id, barcode, article_number, category_id, producer, size, weight_grams,
        purchase_price, price_per_gram, status, created_by
      ) values (
        v_warehouse, v_barcode, nullif(btrim(v_item->>'article_number'), ''),
        public.resolve_product_category(nullif(btrim(v_item->>'category_name'), '')),
        nullif(btrim(v_item->>'producer'), ''), nullif(btrim(v_item->>'size'), ''),
        nullif(v_item->>'weight_grams', '')::numeric,
        nullif(v_item->>'purchase_price', '')::numeric,
        nullif(v_item->>'price_per_gram', '')::numeric,
        'IN_STOCK', v_employee.id
      );
    exception when others then
      raise exception using errcode = sqlstate, message = format('Row %s: %s', v_row, sqlerrm);
    end;
  end loop;
  return v_row;
end
$$;

revoke all on function public.create_inventory_items_batch(jsonb) from public, anon;
grant execute on function public.create_inventory_items_batch(jsonb) to authenticated;
