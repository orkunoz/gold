-- Owner-only atomic manual creation with a selectable active location per draft.
create or replace function public.create_inventory_items_batch(p_items jsonb)
returns integer language plpgsql security definer set search_path = '' set row_security = off
as $$
declare
  v_employee public.employees%rowtype; v_item jsonb; v_row integer := 0;
  v_barcode text; v_shop_id uuid; v_category text; v_producer text; v_weight numeric; v_rate numeric;
begin
  v_employee := public.require_owner_employee();
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then
    raise exception using errcode = '22023', message = 'Batch must contain 1 to 100 products.';
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_row := v_row + 1;
    begin
      v_barcode := nullif(btrim(v_item->>'barcode'), '');
      v_shop_id := nullif(btrim(v_item->>'shop_id'), '')::uuid;
      v_category := nullif(regexp_replace(btrim(v_item->>'category_name'), '\s+', ' ', 'g'), '');
      v_producer := nullif(btrim(v_item->>'producer'), '');
      v_weight := nullif(v_item->>'weight_grams', '')::numeric;
      v_rate := nullif(v_item->>'price_per_gram', '')::numeric;
      if v_category is null or v_producer is null or v_weight is null or v_weight <= 0 or v_rate is null or v_rate <= 0 then
        raise exception using errcode = '22023', message = 'Category, producer, positive weight, and positive price per gram are required.';
      end if;
      if not exists(select 1 from public.shops where id = v_shop_id and is_active) then
        raise exception using errcode = '22023', message = 'Select a valid active location.';
      end if;
      if v_barcode is not null and exists(select 1 from public.inventory_items where barcode = v_barcode) then
        raise exception using errcode = '23505', message = format('barcode %s already exists.', v_barcode);
      end if;
      insert into public.inventory_items(shop_id,barcode,article_number,category_id,producer,size,weight_grams,purchase_price,price_per_gram,status,created_by)
      values(v_shop_id,v_barcode,nullif(btrim(v_item->>'article_number'),''),public.resolve_product_category(v_category),v_producer,
        nullif(btrim(v_item->>'size'),''),v_weight,nullif(v_item->>'purchase_price','')::numeric,v_rate,'IN_STOCK',v_employee.id);
    exception when others then
      raise exception using errcode = sqlstate, message = format('Row %s: %s', v_row, sqlerrm);
    end;
  end loop;
  return v_row;
end $$;
revoke all on function public.create_inventory_items_batch(jsonb) from public, anon;
grant execute on function public.create_inventory_items_batch(jsonb) to authenticated;
