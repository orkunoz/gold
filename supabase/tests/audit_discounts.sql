-- Rollback-only audit/discount/snapshot verification. Requires an active owner.
begin;
do $$
declare e public.employees%rowtype; sh uuid:=gen_random_uuid(); cat uuid:=gen_random_uuid(); item uuid:=gen_random_uuid(); result record; sale_item public.sale_items%rowtype;
begin
 select * into e from public.employees where role='owner' and is_active limit 1; if not found then raise exception 'active owner required'; end if;
 perform set_config('request.jwt.claim.sub',e.auth_user_id::text,true);
 insert into public.shops(id,name,code) values(sh,'Audit rollback shop','AUDIT-ROLLBACK');
 insert into public.product_categories(id,name) values(cat,'Audit Ring');
 insert into public.inventory_items(id,shop_id,barcode,category_id,metal,producer,size,article_number,weight_grams,price_per_gram,owner_price,discount,created_by)
 values(item,sh,'AUDIT-ITEM',cat,'Gold','Producer','17','A-1',3.25,6000,20000,'source only',e.id);
 if (select price from public.inventory_items where id=item)<>19500 then raise exception 'calculated inventory price failed'; end if;
 update public.inventory_items set producer='Changed',weight_grams=4 where id=item;
 if (select count(*) from public.inventory_item_history where inventory_item_id=item and field_name in('Producer','Weight'))<>2 then raise exception 'field history failed'; end if;
 select * into result from public.complete_sale(sh,jsonb_build_array(jsonb_build_object('inventory_item_id',item,'discount_percent',10,'sale_price',18000)),null);
 select * into sale_item from public.sale_items where sale_id=result.sale_id;
 if sale_item.discount_percent<>10 or sale_item.list_price<>24000 or sale_item.sale_price<>18000 or sale_item.producer<>'Changed' or sale_item.barcode<>'AUDIT-ITEM' then raise exception 'discount/snapshot failed'; end if;
 if not exists(select 1 from public.inventory_item_history where inventory_item_id=item and field_name='Status' and source='SALE' and sale_id=result.sale_id) then raise exception 'sale history failed'; end if;
 if has_table_privilege('authenticated','public.inventory_item_history','UPDATE') or has_table_privilege('authenticated','public.inventory_item_history','DELETE') or has_table_privilege('anon','public.inventory_item_history','SELECT') then raise exception 'history grants are unsafe'; end if;
 perform public.get_sold_products_register(sh,'Audit Ring','Changed','Gold',e.id,null,null,'AUDIT',1,50);
 begin perform public.complete_sale(sh,jsonb_build_array(jsonb_build_object('inventory_item_id',item,'discount_percent',101,'sale_price',1)),null); raise exception 'invalid discount succeeded'; exception when data_exception then null; end;
end $$;
rollback;
