-- Rollback-only Task 10 schema/integrity verification. Requires an active owner.
begin;
do $$
declare
  v_employee public.employees%rowtype;
  v_shop uuid:=gen_random_uuid();
  v_null_a uuid:=gen_random_uuid(); v_null_b uuid:=gen_random_uuid(); v_sellable uuid:=gen_random_uuid();
  v_sale record;
begin
  select * into v_employee from public.employees where role='owner' and is_active order by created_at limit 1;
  if not found then raise exception 'Task 10 verification requires an active owner'; end if;
  perform set_config('request.jwt.claim.sub',v_employee.auth_user_id::text,true);
  insert into public.shops(id,name,code) values(v_shop,'Task 10 rollback shop','TASK10-ROLLBACK');

  insert into public.inventory_items(id,shop_id,barcode,metal,producer,price_per_gram,price,discount)
  values(v_null_a,v_shop,null,'Gold','Task Producer',2100,5000,'10%'),(v_null_b,v_shop,null,null,null,null,null,null);
  if (select count(*) from public.inventory_items where id in(v_null_a,v_null_b))<>2 then raise exception 'multiple null barcodes failed'; end if;
  if (select status from public.inventory_items where id=v_null_b)<>'IN_STOCK' then raise exception 'status default failed'; end if;

  insert into public.inventory_items(id,shop_id,barcode,owner_price,status) values(v_sellable,v_shop,'TASK10-UNIQUE',100,'IN_STOCK');
  begin
    insert into public.inventory_items(shop_id,barcode) values(v_shop,'TASK10-UNIQUE');
    raise exception 'duplicate non-null barcode succeeded';
  exception when unique_violation then null; end;
  begin
    insert into public.inventory_items(shop_id,metal) values(v_shop,'Platinum');
    raise exception 'invalid metal succeeded';
  exception when check_violation then null; end;
  begin
    insert into public.inventory_items(shop_id,price) values(v_shop,-1);
    raise exception 'negative source price succeeded';
  exception when check_violation then null; end;

  select * into v_sale from public.complete_sale(v_shop,jsonb_build_array(jsonb_build_object('inventory_item_id',v_sellable,'sale_price',100)),'TASK 10 ROLLBACK');
  if (select status from public.inventory_items where id=v_sellable)<>'SOLD'
    or not exists(select 1 from public.sale_items where sale_id=v_sale.sale_id and inventory_item_id=v_sellable)
  then raise exception 'sale regression failed'; end if;
  perform public.get_sales_register(v_shop,null,1,25);
end $$;
rollback;
