-- Rollback-only Task 9 sales register verification. Requires an active owner.
begin;
do $$
declare
  v_employee public.employees%rowtype;
  v_shop_a uuid:=gen_random_uuid(); v_shop_b uuid:=gen_random_uuid();
  v_ring uuid:=gen_random_uuid(); v_bracelet uuid:=gen_random_uuid();
  v_item_a uuid:=gen_random_uuid(); v_item_b uuid:=gen_random_uuid(); v_item_c uuid:=gen_random_uuid(); v_item_d uuid:=gen_random_uuid();
  v_sale_a uuid:=gen_random_uuid(); v_sale_b uuid:=gen_random_uuid(); v_sale_c uuid:=gen_random_uuid();
  v_report jsonb;
begin
  select * into v_employee from public.employees where role='owner' and is_active order by created_at limit 1;
  if not found then raise exception 'Task 9 verification requires an active owner'; end if;
  perform set_config('request.jwt.claim.sub',v_employee.auth_user_id::text,true);

  insert into public.shops(id,name,code) values(v_shop_a,'Task 9 Shop A','TASK9-A'),(v_shop_b,'Task 9 Shop B','TASK9-B');
  insert into public.product_categories(id,name) values(v_ring,'Task 9 Ring'),(v_bracelet,'Task 9 Bracelet');
  insert into public.inventory_items(id,shop_id,barcode,category_id,status) values
    (v_item_a,v_shop_a,'TASK9-A',v_ring,'SOLD'),(v_item_b,v_shop_a,'TASK9-B',v_bracelet,'SOLD'),
    (v_item_c,v_shop_a,'TASK9-C',v_ring,'SOLD'),(v_item_d,v_shop_b,'TASK9-D',v_bracelet,'SOLD');
  insert into public.sales(id,shop_id,employee_id,sale_number,sold_at,total_sale_price) values
    (v_sale_a,v_shop_a,v_employee.id,'TASK9-SALE-A',now(),200),
    (v_sale_b,v_shop_a,v_employee.id,'TASK9-SALE-B',now()-interval '1 hour',100),
    (v_sale_c,v_shop_b,v_employee.id,'TASK9-SALE-C',now()-interval '2 hours',100);
  insert into public.sale_items(sale_id,inventory_item_id,sale_price) values
    (v_sale_a,v_item_a,100),(v_sale_a,v_item_b,100),(v_sale_b,v_item_c,100),(v_sale_c,v_item_d,100);

  v_report:=public.get_sales_register(null,null,1,25);
  if (v_report->>'count')::int<3 or jsonb_array_length(v_report->'sales')<3 then raise exception 'owner all-shop register failed'; end if;
  v_report:=public.get_sales_register(v_shop_a,null,1,25);
  if (v_report->>'count')::int<>2 then raise exception 'owner shop filter failed'; end if;
  v_report:=public.get_sales_register(null,v_ring::text,1,25);
  if (v_report->>'count')::int<>2 then raise exception 'owner category filter failed'; end if;
  v_report:=public.get_sales_register(v_shop_a,v_bracelet::text,1,25);
  if (v_report->>'count')::int<>1 or jsonb_array_length(v_report->'sales')<>1
    or (v_report#>>'{sales,0,item_count}')::int<>2 or jsonb_array_length(v_report#>'{sales,0,products}')<>2
  then raise exception 'combined filter duplicated or lost full sale summary'; end if;
  v_report:=public.get_sales_register(v_shop_a,null,2,1);
  if (v_report->>'count')::int<>2 or (v_report->>'page')::int<>2 or jsonb_array_length(v_report->'sales')<>1 then raise exception 'filtered pagination failed'; end if;

  update public.employees set role='manager',shop_id=v_shop_a where id=v_employee.id;
  perform public.get_sales_register(v_shop_a,v_ring::text,1,25);
  begin perform public.get_sales_register(v_shop_b,null,1,25); raise exception 'manager cross-shop filter succeeded'; exception when insufficient_privilege then null; end;
  update public.employees set role='salesperson',shop_id=v_shop_a where id=v_employee.id;
  perform public.get_sales_register(null,v_bracelet::text,1,25);
  begin perform public.get_sales_register(v_shop_b,null,1,25); raise exception 'salesperson cross-shop filter succeeded'; exception when insufficient_privilege then null; end;
  update public.employees set role='owner',shop_id=v_employee.shop_id where id=v_employee.id;

  if not exists(select 1 from public.sales where id=v_sale_a) or not exists(select 1 from public.sale_items where sale_id=v_sale_a) then raise exception 'historical sale detail data changed'; end if;
  if has_function_privilege('anon','public.get_sales_register(uuid,text,integer,integer)','EXECUTE')
    or not has_function_privilege('authenticated','public.get_sales_register(uuid,text,integer,integer)','EXECUTE')
  then raise exception 'sales register grants incorrect'; end if;
end $$;
rollback;
