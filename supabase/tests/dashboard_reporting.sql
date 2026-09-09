-- Rollback-only Task 6 reporting verification. Requires an active owner.
begin;
do $$
declare
  v_employee public.employees%rowtype;
  v_shop_a uuid:=gen_random_uuid(); v_shop_b uuid:=gen_random_uuid(); v_empty_shop uuid:=gen_random_uuid();
  v_category uuid:=gen_random_uuid(); v_sale_a uuid:=gen_random_uuid(); v_sale_b uuid:=gen_random_uuid(); v_old_sale uuid:=gen_random_uuid();
  v_sold_a uuid:=gen_random_uuid(); v_sold_b uuid:=gen_random_uuid(); v_sold_c uuid:=gen_random_uuid(); v_old_item uuid:=gen_random_uuid();
  v_stock_manual uuid:=gen_random_uuid(); v_stock_rule uuid:=gen_random_uuid(); v_stock_missing uuid:=gen_random_uuid();
  v_today_start timestamptz:=((statement_timestamp() at time zone 'Europe/Kyiv')::date)::timestamp at time zone 'Europe/Kyiv';
  v_report jsonb; v_revenue_before numeric;
begin
  select * into v_employee from public.employees where role='owner' and is_active order by created_at limit 1;
  if not found then raise exception 'Task 6 verification requires an active owner'; end if;
  perform set_config('request.jwt.claim.sub',v_employee.auth_user_id::text,true);
  insert into public.shops(id,name,code) values(v_shop_a,'Task 6 Shop A','TASK6-A'),(v_shop_b,'Task 6 Shop B','TASK6-B'),(v_empty_shop,'Task 6 Empty','TASK6-E');
  insert into public.product_categories(id,name) values(v_category,'Task 6 Rings');
  insert into public.inventory_items(id,shop_id,barcode,category_id,weight_grams,owner_price,selling_price,status) values
    (v_sold_a,v_shop_a,'TASK6-SOLD-A',v_category,2,100,null,'SOLD'),(v_sold_b,v_shop_a,'TASK6-SOLD-B',null,3,200,null,'SOLD'),
    (v_sold_c,v_shop_b,'TASK6-SOLD-C',v_category,4,300,null,'SOLD'),(v_old_item,v_shop_a,'TASK6-OLD',null,5,999,null,'SOLD'),
    (v_stock_manual,v_shop_a,'TASK6-STOCK-M',v_category,1,90,100,'IN_STOCK'),(v_stock_rule,v_shop_a,'TASK6-STOCK-R',v_category,2,200,null,'IN_STOCK'),
    (v_stock_missing,v_shop_a,'TASK6-STOCK-N',null,null,null,null,'IN_STOCK');
  insert into public.inventory_items(shop_id,barcode,status) values(v_shop_a,'TASK6-RESERVED','RESERVED'),(v_shop_a,'TASK6-REMOVED','REMOVED');
  insert into public.pricing_rules(name,shop_id,category_id,rule_type,rule_value,created_by) values('Task 6 rule',v_shop_a,v_category,'FIXED_AMOUNT',50,v_employee.id);

  insert into public.sales(id,shop_id,employee_id,sale_number,sold_at,total_list_price,total_sale_price) values
    (v_sale_a,v_shop_a,v_employee.id,'TASK6-SALE-A',v_today_start+interval '1 hour',300,300),
    (v_sale_b,v_shop_b,v_employee.id,'TASK6-SALE-B',v_today_start+interval '2 hour',400,400),
    (v_old_sale,v_shop_a,v_employee.id,'TASK6-OLD-SALE',v_today_start-interval '1 second',999,999);
  insert into public.sale_items(sale_id,inventory_item_id,list_price,sale_price) values
    (v_sale_a,v_sold_a,100,100),(v_sale_a,v_sold_b,200,200),(v_sale_b,v_sold_c,400,400),(v_old_sale,v_old_item,999,999);

  v_report:=public.get_dashboard_report('TODAY',null);
  if (v_report#>>'{kpis,revenue}')::numeric<>700 or (v_report#>>'{kpis,sales_count}')::int<>2 or (v_report#>>'{kpis,items_sold}')::int<>3 then raise exception 'all-shop sales KPI aggregation failed'; end if;
  if (v_report#>>'{kpis,gold_weight_sold}')::numeric<>9 or (v_report#>>'{kpis,average_sale}')::numeric<>350 then raise exception 'weight/average aggregation failed'; end if;
  if not exists(select 1 from jsonb_array_elements(v_report->'shops') row_data where row_data->>'shop'='Task 6 Shop A')
    or not exists(select 1 from jsonb_array_elements(v_report->'shops') row_data where row_data->>'shop'='Task 6 Shop B')
  then raise exception 'owner all-shop comparison failed'; end if;
  if jsonb_array_length(v_report->'categories')<>2 or jsonb_array_length(v_report->'employees')<>2 then raise exception 'category/employee aggregation failed'; end if;
  if v_report->>'timezone'<>'Europe/Kyiv' or v_report->>'start_at' is null then raise exception 'timezone metadata missing'; end if;

  v_report:=public.get_dashboard_report('TODAY',v_shop_a);
  if (v_report#>>'{kpis,revenue}')::numeric<>300 or (v_report#>>'{kpis,sales_count}')::int<>1 or (v_report#>>'{kpis,items_sold}')::int<>2 or (v_report#>>'{kpis,gold_weight_sold}')::numeric<>5 then raise exception 'shop filter failed'; end if;
  if (v_report#>>'{inventory,in_stock_items}')::int<>3 or (v_report#>>'{inventory,in_stock_weight}')::numeric<>3 then raise exception 'current stock count/weight failed'; end if;
  if (v_report#>>'{inventory,customer_value}')::numeric<>350 or (v_report#>>'{inventory,missing_price_items}')::int<>1 then raise exception 'effective inventory valuation failed'; end if;
  if (v_report#>>'{status_counts,RESERVED}')::int<>1 or (v_report#>>'{status_counts,REMOVED}')::int<>1 then raise exception 'status summary failed'; end if;

  v_report:=public.get_dashboard_report('LAST_7_DAYS',v_shop_a);
  if (v_report#>>'{kpis,revenue}')::numeric<>1299 then raise exception 'date filtering boundary failed'; end if;
  v_report:=public.get_dashboard_report('TODAY',v_empty_shop);
  if (v_report#>>'{kpis,revenue}')::numeric<>0 or (v_report#>>'{kpis,average_sale}')::numeric<>0 or (v_report#>>'{inventory,in_stock_items}')::int<>0 then raise exception 'empty reporting state failed'; end if;

  v_revenue_before:=(public.get_dashboard_report('TODAY',v_shop_a)#>>'{kpis,revenue}')::numeric;
  update public.pricing_rules set rule_value=500 where name='Task 6 rule';
  if (public.get_dashboard_report('TODAY',v_shop_a)#>>'{kpis,revenue}')::numeric<>v_revenue_before then raise exception 'pricing change altered historical revenue'; end if;

  update public.employees set role='manager',shop_id=v_shop_a where id=v_employee.id;
  perform public.get_dashboard_report('TODAY',v_shop_a);
  begin perform public.get_dashboard_report('TODAY',v_shop_b); raise exception 'manager cross-shop report succeeded'; exception when insufficient_privilege then null; end;
  update public.employees set role='salesperson',shop_id=v_shop_a where id=v_employee.id;
  v_report:=public.get_dashboard_report('LAST_30_DAYS',null);
  if v_report->>'period'<>'TODAY' or v_report->'inventory'<>'null'::jsonb or v_report->'employees'<>'null'::jsonb or (v_report#>>'{kpis,revenue}')::numeric<>300 then raise exception 'salesperson dashboard restriction failed'; end if;
  begin perform public.get_dashboard_report('TODAY',v_shop_b); raise exception 'salesperson cross-shop report succeeded'; exception when insufficient_privilege then null; end;
  update public.employees set role='owner',shop_id=v_shop_a where id=v_employee.id;

  if has_function_privilege('anon','public.get_dashboard_report(text,uuid)','EXECUTE') or not has_function_privilege('authenticated','public.get_dashboard_report(text,uuid)','EXECUTE') then raise exception 'dashboard RPC grants incorrect'; end if;
end $$;
rollback;
