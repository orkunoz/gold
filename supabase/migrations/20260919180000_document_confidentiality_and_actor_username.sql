-- Keep immutable document actor labels useful and confidential document data out of application responses.
-- Existing snapshots are updated only where the still-linked employee provides an authoritative username.
update public.added_product_documents d set created_by_name=e.username
from public.employees e where d.created_by_employee_id=e.id and e.username is not null;
update public.transfers t set performed_by_name=e.username
from public.employees e where t.performed_by_employee_id=e.id and e.username is not null;

create or replace function public.create_inventory_items_batch(p_items jsonb)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare
 v_employee public.employees%rowtype;v_item jsonb;v_row integer:=0;v_document_id uuid;v_inventory_id uuid;v_category_id uuid;v_location_name text;
 v_barcode text;v_shop_id uuid;v_category text;v_article text;v_producer text;v_weight numeric;v_rate numeric;v_purchase numeric;
begin
 v_employee:=public.require_owner_employee();
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>100 then raise exception using errcode='22023',message='Batch must contain 1 to 100 products.';end if;
 insert into public.added_product_documents(document_number,created_by_employee_id,created_by_name,location_names,product_count,total_weight,total_purchase_value,total_value)
 values('GR-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'||lpad(nextval('public.added_product_document_number_seq')::text,6,'0'),v_employee.id,coalesce(v_employee.username,v_employee.full_name,'owner'),'{}',jsonb_array_length(p_items),0,0,0)
 returning id into v_document_id;
 for v_item in select value from jsonb_array_elements(p_items) loop
  v_row:=v_row+1;
  begin
   v_barcode:=nullif(btrim(v_item->>'barcode'),'');v_shop_id:=nullif(btrim(v_item->>'shop_id'),'')::uuid;
   v_category:=nullif(regexp_replace(btrim(v_item->>'category_name'),'\s+',' ','g'),'');v_article:=nullif(btrim(v_item->>'article_number'),'');v_producer:=nullif(btrim(v_item->>'producer'),'');
   v_weight:=nullif(v_item->>'weight_grams','')::numeric;v_rate:=nullif(v_item->>'price_per_gram','')::numeric;v_purchase:=nullif(v_item->>'purchase_price','')::numeric;
   if v_category is null or v_article is null or v_producer is null or v_weight is null or v_weight<=0 or v_purchase is null or v_purchase<0 or v_rate is null or v_rate<=0 then raise exception using errcode='22023',message='Category, article, producer, positive weight, purchase price, and positive price per gram are required.';end if;
   select name into v_location_name from public.shops where id=v_shop_id and is_active;if not found then raise exception using errcode='22023',message='Select a valid active location.';end if;
   if v_barcode is not null and exists(select 1 from public.inventory_items where barcode=v_barcode)then raise exception using errcode='23505',message=format('barcode %s already exists.',v_barcode);end if;
   v_category_id:=public.resolve_product_category(v_category);
   insert into public.inventory_items(shop_id,barcode,article_number,category_id,producer,size,weight_grams,purchase_price,price_per_gram,status,created_by)
   values(v_shop_id,v_barcode,v_article,v_category_id,v_producer,nullif(btrim(v_item->>'size'),''),v_weight,v_purchase,v_rate,'IN_STOCK',v_employee.id)returning id into v_inventory_id;
   insert into public.added_product_document_items(document_id,line_number,inventory_item_id,category_name,article_number,producer,size,weight_grams,purchase_price,price_per_gram,price,status,location_id,location_name,barcode,product_created_at)
   select v_document_id,v_row,i.id,c.name,i.article_number,i.producer,i.size,i.weight_grams,i.purchase_price,i.price_per_gram,i.price,i.status,i.shop_id,v_location_name,i.barcode,i.created_at from public.inventory_items i join public.product_categories c on c.id=i.category_id where i.id=v_inventory_id;
  exception when others then raise exception using errcode=sqlstate,message=format('Row %s: %s',v_row,sqlerrm);end;
 end loop;
 update public.added_product_documents d set location_names=(select array_agg(distinct i.location_name order by i.location_name)from public.added_product_document_items i where i.document_id=d.id),total_weight=(select coalesce(sum(i.weight_grams),0)from public.added_product_document_items i where i.document_id=d.id),total_purchase_value=(select coalesce(sum(i.purchase_price),0)from public.added_product_document_items i where i.document_id=d.id),total_value=(select coalesce(sum(i.price),0)from public.added_product_document_items i where i.document_id=d.id)where d.id=v_document_id;
 return jsonb_build_object('count',v_row,'document_id',v_document_id);
end $$;
revoke all on function public.create_inventory_items_batch(jsonb) from public,anon;
grant execute on function public.create_inventory_items_batch(jsonb) to authenticated;

create or replace function public.bulk_move_inventory_items_with_transfer(p_inventory_item_ids uuid[],p_shop_id uuid)
returns uuid language plpgsql security definer set search_path='' set row_security=off as $$
declare v_actor public.employees%rowtype;v_requested int;v_source_count int;v_source_id uuid;v_source public.shops%rowtype;v_dest public.shops%rowtype;v_transfer uuid;
begin v_actor:=public.require_owner_employee();v_requested:=coalesce(array_length(p_inventory_item_ids,1),0);
 if v_requested<1 or v_requested>50 or v_requested<>(select count(distinct x)from unnest(p_inventory_item_ids)x)then raise exception using errcode='22023',message='Select 1 to 50 unique products.';end if;
 select * into v_dest from public.shops where id=p_shop_id and is_active;if not found then raise exception using errcode='22023',message='Select an active destination location.';end if;
 perform i.id from public.inventory_items i where i.id=any(p_inventory_item_ids)order by i.id for update;
 if(select count(*)from public.inventory_items where id=any(p_inventory_item_ids))<>v_requested then raise exception using errcode='22023',message='A selected product no longer exists.';end if;
 if exists(select 1 from public.inventory_items where id=any(p_inventory_item_ids)and status not in('IN_STOCK','REMOVED'))then raise exception using errcode='22023',message='SOLD products cannot be moved.';end if;
 select count(distinct shop_id),(array_agg(distinct shop_id))[1]into v_source_count,v_source_id from public.inventory_items where id=any(p_inventory_item_ids);
 if v_source_count<>1 or v_source_id is null then raise exception using errcode='22023',message='Selected products must have one assigned source location.';end if;
 select * into v_source from public.shops where id=v_source_id;if v_source.id=v_dest.id then raise exception using errcode='22023',message='Source and destination must differ.';end if;
 insert into public.transfers(transfer_number,source_location_id,destination_location_id,source_name,destination_name,source_address,destination_address,performed_by_employee_id,performed_by_name,item_count,total_weight,total_value)
 select'TR-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'||lpad(nextval('public.transfer_number_seq')::text,6,'0'),v_source.id,v_dest.id,v_source.name,v_dest.name,v_source.address,v_dest.address,v_actor.id,coalesce(v_actor.username,v_actor.full_name,'owner'),count(*),coalesce(sum(weight_grams),0),coalesce(sum(price),0)from public.inventory_items where id=any(p_inventory_item_ids)returning id into v_transfer;
 insert into public.transfer_items(transfer_id,line_number,inventory_item_id,category_name,producer,size,weight_grams,purchase_price,price_per_gram,price,article_number,barcode)
 select v_transfer,row_number()over(order by i.id),i.id,c.name,i.producer,i.size,i.weight_grams,i.purchase_price,i.price_per_gram,i.price,i.article_number,i.barcode from public.inventory_items i left join public.product_categories c on c.id=i.category_id where i.id=any(p_inventory_item_ids);
 perform set_config('gold.audit_source','SHOP_TRANSFER',true);update public.inventory_items set shop_id=p_shop_id where id=any(p_inventory_item_ids);
 if(select count(*)from public.inventory_items where id=any(p_inventory_item_ids)and shop_id=p_shop_id)<>v_requested then raise exception using errcode='40001',message='Inventory location update failed.';end if;
 return v_transfer;end $$;
revoke all on function public.bulk_move_inventory_items_with_transfer(uuid[],uuid) from public,anon;
grant execute on function public.bulk_move_inventory_items_with_transfer(uuid[],uuid) to authenticated;
