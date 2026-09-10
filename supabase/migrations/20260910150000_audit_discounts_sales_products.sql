-- Product audit history, calculated source price, checkout discounts, and sold-product register.
create or replace function public.set_inventory_calculated_price()
returns trigger language plpgsql set search_path='' as $$
begin
  new.price:=case when new.weight_grams is null or new.price_per_gram is null then null else round(new.weight_grams*new.price_per_gram,2) end;
  return new;
end $$;
create trigger inventory_items_calculate_price before insert or update of weight_grams,price_per_gram,price on public.inventory_items for each row execute function public.set_inventory_calculated_price();
update public.inventory_items set price=case when weight_grams is null or price_per_gram is null then null else round(weight_grams*price_per_gram,2) end;

create table public.inventory_item_history(
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  field_name text not null,
  old_value text,
  new_value text,
  changed_by_employee_id uuid references public.employees(id) on delete restrict,
  changed_at timestamptz not null default now(),
  source text not null check(source in('MANUAL_EDIT','XLSX_IMPORT','SALE','STATUS_CHANGE','SHOP_TRANSFER','SYSTEM')),
  sale_id uuid references public.sales(id) on delete restrict
);
create index inventory_item_history_item_changed_idx on public.inventory_item_history(inventory_item_id,changed_at desc);
alter table public.inventory_item_history enable row level security;
revoke all on public.inventory_item_history from public,anon,authenticated;
grant select on public.inventory_item_history to authenticated;
create policy inventory_history_select on public.inventory_item_history for select to authenticated using(exists(select 1 from public.inventory_items i where i.id=inventory_item_id and public.can_access_shop(i.shop_id)));

create or replace function public.record_inventory_history() returns trigger language plpgsql security definer set search_path='' set row_security=off as $$
declare v_employee uuid; v_source text; v_sale uuid; v_field text; v_old text; v_new text;
begin
 select id into v_employee from public.employees where auth_user_id=(select auth.uid()) and is_active limit 1;
 v_source:=coalesce(nullif(current_setting('gold.audit_source',true),''),case when tg_op='INSERT' then 'SYSTEM' else 'MANUAL_EDIT' end);
 begin v_sale:=nullif(current_setting('gold.audit_sale_id',true),'')::uuid; exception when invalid_text_representation then v_sale:=null; end;
 if tg_op='INSERT' then
   insert into public.inventory_item_history(inventory_item_id,field_name,new_value,changed_by_employee_id,source,sale_id) values(new.id,'CREATED','Inventory item created',v_employee,v_source,v_sale);
   return new;
 end if;
 for v_field,v_old,v_new in
   select * from (values
    ('Product Category',old.category_id::text,new.category_id::text),('Metal',old.metal,new.metal),('Producer',old.producer,new.producer),
    ('Size',old.size,new.size),('Article',old.article_number,new.article_number),('Weight',old.weight_grams::text,new.weight_grams::text),
    ('Price per Gram',old.price_per_gram::text,new.price_per_gram::text),('Inventory Price',old.price::text,new.price::text),
    ('Inventory Discount',old.discount,new.discount),('Status',old.status,new.status),('Shop',old.shop_id::text,new.shop_id::text),
    ('Barcode',old.barcode,new.barcode),('Notes',old.notes,new.notes),('Owner/base price',old.owner_price::text,new.owner_price::text),
    ('Manual selling price',old.selling_price::text,new.selling_price::text)
   ) changes(field_name,old_value,new_value) where old_value is distinct from new_value
 loop
   insert into public.inventory_item_history(inventory_item_id,field_name,old_value,new_value,changed_by_employee_id,source,sale_id)
   values(new.id,v_field,v_old,v_new,v_employee,case when v_source='MANUAL_EDIT' and v_field='Status' then 'STATUS_CHANGE' when v_source='MANUAL_EDIT' and v_field='Shop' then 'SHOP_TRANSFER' else v_source end,v_sale);
 end loop;
 return new;
end $$;
create trigger inventory_items_history_insert after insert on public.inventory_items for each row execute function public.record_inventory_history();
create trigger inventory_items_history_update after update on public.inventory_items for each row execute function public.record_inventory_history();

create or replace function public.import_inventory_items(p_items jsonb) returns integer language plpgsql security definer set search_path='' set row_security=off as $$
declare e public.employees%rowtype; inserted_count int;
begin
 select * into e from public.employees where auth_user_id=(select auth.uid()) and is_active limit 1;
 if not found or e.role not in('owner','manager') then raise exception using errcode='42501',message='Owner or manager access required.'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>100 then raise exception using errcode='22023',message='Import batch must contain 1 to 100 items.'; end if;
 if exists(select 1 from jsonb_to_recordset(p_items) x(shop_id uuid,status text) where x.shop_id is null or not public.can_access_shop(x.shop_id) or not exists(select 1 from public.shops s where s.id=x.shop_id and s.is_active) or coalesce(x.status,'IN_STOCK')='SOLD') then raise exception using errcode='42501',message='Import contains an unauthorized shop or SOLD status.'; end if;
 perform set_config('gold.audit_source','XLSX_IMPORT',true);
 insert into public.inventory_items(shop_id,barcode,article_number,category_id,metal,producer,size,weight_grams,price_per_gram,discount,notes,status,created_by)
 select x.shop_id,nullif(btrim(x.barcode),''),nullif(btrim(x.article_number),''),x.category_id,x.metal,nullif(btrim(x.producer),''),nullif(btrim(x.size),''),x.weight_grams,x.price_per_gram,nullif(btrim(x.discount),''),nullif(btrim(x.notes),''),coalesce(x.status,'IN_STOCK'),e.id
 from jsonb_to_recordset(p_items) x(shop_id uuid,barcode text,article_number text,category_id uuid,metal text,producer text,size text,weight_grams numeric,price_per_gram numeric,discount text,notes text,status text);
 get diagnostics inserted_count=row_count; return inserted_count;
end $$;
revoke all on function public.import_inventory_items(jsonb) from public,anon; grant execute on function public.import_inventory_items(jsonb) to authenticated;

alter table public.sale_items add column discount_percent numeric(7,4) not null default 0 check(discount_percent>=0 and discount_percent<=100);
alter table public.sale_items add column category_name text, add column producer text, add column size text, add column article_number text,
 add column weight_grams numeric, add column price_per_gram numeric(14,2), add column metal text, add column barcode text, add column notes text;
create index sale_items_category_name_idx on public.sale_items(category_name);
create index sale_items_producer_idx on public.sale_items(producer) where producer is not null;

create or replace function public.complete_sale(p_shop_id uuid,p_items jsonb,p_notes text default null)
returns table(sale_id uuid,sale_number text,sold_at timestamptz,total_sale_price numeric,item_count integer)
language plpgsql security definer set search_path='' set row_security=off as $$
declare v_employee public.employees%rowtype; v_sale_id uuid; v_sale_number text; v_sold_at timestamptz; v_total_list numeric(14,2); v_total_sale numeric(14,2); v_count int; v_distinct int; v_locked int:=0; v_inventory public.inventory_items%rowtype; v_notes text;
begin
 if (select auth.uid()) is null then raise exception using errcode='42501',message='Authentication required.'; end if;
 select * into v_employee from public.employees where auth_user_id=(select auth.uid()) and is_active limit 1;
 if not found or v_employee.role not in('owner','manager','salesperson') then raise exception using errcode='42501',message='An active employee account is required.'; end if;
 if not exists(select 1 from public.shops where id=p_shop_id and is_active) then raise exception using errcode='22023',message='Select an active shop.'; end if;
 if v_employee.role<>'owner' and v_employee.shop_id is distinct from p_shop_id then raise exception using errcode='42501',message='You cannot complete a sale for this shop.'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>100 then raise exception using errcode='22023',message='A sale must contain between 1 and 100 items.'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) r where jsonb_typeof(r)<>'object' or not(r?'inventory_item_id') or not(r?'sale_price') or jsonb_typeof(r->'inventory_item_id')<>'string' or jsonb_typeof(r->'sale_price')<>'number' or (r?'discount_percent' and jsonb_typeof(r->'discount_percent')<>'number') or r-'inventory_item_id'-'sale_price'-'discount_percent'<>'{}') then raise exception using errcode='22023',message='Each sale item may contain only inventory_item_id, discount_percent, and sale_price.'; end if;
 begin select count(*),count(distinct (r->>'inventory_item_id')::uuid) into v_count,v_distinct from jsonb_array_elements(p_items) r; exception when invalid_text_representation then raise exception using errcode='22023',message='Every inventory_item_id must be a valid UUID.'; end;
 if v_count<>v_distinct then raise exception using errcode='22023',message='The same inventory item cannot appear twice in one sale.'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) r where (r->>'sale_price')::numeric<0 or (r->>'sale_price')::numeric>999999999999.99 or coalesce((r->>'discount_percent')::numeric,0)<0 or coalesce((r->>'discount_percent')::numeric,0)>100) then raise exception using errcode='22023',message='Check sale prices and discounts.'; end if;
 for v_inventory in select i.* from public.inventory_items i join jsonb_array_elements(p_items) r on i.id=(r->>'inventory_item_id')::uuid order by i.id for update of i loop v_locked:=v_locked+1; if v_inventory.shop_id<>p_shop_id then raise exception using errcode='22023',message='An inventory item does not belong to the sale shop.'; end if; if v_inventory.status<>'IN_STOCK' then raise exception using errcode='22023',message='Every inventory item must be IN_STOCK.'; end if; end loop;
 if v_locked<>v_count then raise exception using errcode='22023',message='One or more inventory items do not exist.'; end if;
 v_notes:=nullif(btrim(p_notes),''); if length(v_notes)>5000 then raise exception using errcode='22023',message='Sale notes cannot exceed 5000 characters.'; end if;
 v_sale_number:='SALE-'||to_char(statement_timestamp() at time zone 'UTC','YYYYMMDD')||'-'||lpad(nextval('public.sale_number_sequence'::regclass)::text,6,'0');
 insert into public.sales(shop_id,employee_id,sale_number,total_sale_price,notes) values(p_shop_id,v_employee.id,v_sale_number,0,v_notes) returning id,public.sales.sold_at into v_sale_id,v_sold_at;
 insert into public.sale_items(sale_id,inventory_item_id,list_price,discount_percent,sale_price,category_name,producer,size,article_number,weight_grams,price_per_gram,metal,barcode,notes)
 select v_sale_id,i.id,p.effective_price,coalesce((r->>'discount_percent')::numeric,0),(r->>'sale_price')::numeric(14,2),c.name,i.producer,i.size,i.article_number,i.weight_grams,i.price_per_gram,i.metal,i.barcode,i.notes from jsonb_array_elements(p_items) r join public.inventory_items i on i.id=(r->>'inventory_item_id')::uuid left join public.product_categories c on c.id=i.category_id cross join lateral public.get_effective_inventory_price(i.id) p;
 select sum(list_price),sum(sale_price) into v_total_list,v_total_sale from public.sale_items where public.sale_items.sale_id=v_sale_id;
 update public.sales set total_list_price=v_total_list,total_sale_price=v_total_sale where id=v_sale_id;
 perform set_config('gold.audit_source','SALE',true); perform set_config('gold.audit_sale_id',v_sale_id::text,true);
 update public.inventory_items set status='SOLD' where id in(select (r->>'inventory_item_id')::uuid from jsonb_array_elements(p_items) r);
 return query select v_sale_id,v_sale_number,v_sold_at,v_total_sale::numeric,v_count;
end $$;
revoke all on function public.complete_sale(uuid,jsonb,text) from public,anon; grant execute on function public.complete_sale(uuid,jsonb,text) to authenticated;

create or replace function public.get_sold_products_register(p_shop_id uuid default null,p_category text default null,p_producer text default null,p_metal text default null,p_employee_id uuid default null,p_from timestamptz default null,p_to timestamptz default null,p_search text default null,p_page int default 1,p_page_size int default 50) returns jsonb
language plpgsql stable security definer set search_path='' set row_security=off as $$
declare e public.employees%rowtype; effective_shop uuid; total bigint; rows jsonb;
begin
 select * into e from public.employees where auth_user_id=(select auth.uid()) and is_active limit 1; if not found then raise exception using errcode='42501',message='Active employee required.'; end if;
 if e.role='owner' then effective_shop:=p_shop_id; else effective_shop:=e.shop_id; if p_shop_id is not null and p_shop_id is distinct from e.shop_id then raise exception using errcode='42501',message='Another shop is not accessible.'; end if; end if;
 if p_page<1 or p_page_size<1 or p_page_size>100 then raise exception using errcode='22023',message='Invalid pagination.'; end if;
 with filtered as(select si.*,s.sale_number,s.sold_at,s.shop_id,s.employee_id,sh.name shop_name,coalesce(emp.full_name,'Staff member') employee_name from public.sale_items si join public.sales s on s.id=si.sale_id join public.shops sh on sh.id=s.shop_id join public.employees emp on emp.id=s.employee_id where (effective_shop is null or s.shop_id=effective_shop) and (p_category is null or coalesce(si.category_name,'Uncategorized')=p_category) and (p_producer is null or si.producer ilike p_producer) and (p_metal is null or si.metal=p_metal) and (p_employee_id is null or s.employee_id=p_employee_id) and (p_from is null or s.sold_at>=p_from) and (p_to is null or s.sold_at<p_to) and (p_search is null or si.article_number ilike '%'||p_search||'%' or si.barcode ilike '%'||p_search||'%' or si.producer ilike '%'||p_search||'%' or s.sale_number ilike '%'||p_search||'%')) select count(*) into total from filtered;
 with filtered as(select si.*,s.sale_number,s.sold_at,s.shop_id,s.employee_id,sh.name shop_name,coalesce(emp.full_name,'Staff member') employee_name from public.sale_items si join public.sales s on s.id=si.sale_id join public.shops sh on sh.id=s.shop_id join public.employees emp on emp.id=s.employee_id where (effective_shop is null or s.shop_id=effective_shop) and (p_category is null or coalesce(si.category_name,'Uncategorized')=p_category) and (p_producer is null or si.producer ilike p_producer) and (p_metal is null or si.metal=p_metal) and (p_employee_id is null or s.employee_id=p_employee_id) and (p_from is null or s.sold_at>=p_from) and (p_to is null or s.sold_at<p_to) and (p_search is null or si.article_number ilike '%'||p_search||'%' or si.barcode ilike '%'||p_search||'%' or si.producer ilike '%'||p_search||'%' or s.sale_number ilike '%'||p_search||'%') order by s.sold_at desc,si.created_at,si.id offset (p_page-1)*p_page_size limit p_page_size) select coalesce(jsonb_agg(to_jsonb(filtered)),'[]') into rows from filtered;
 return jsonb_build_object('products',rows,'count',total,'page',p_page,'page_size',p_page_size);
end $$;
revoke all on function public.get_sold_products_register(uuid,text,text,text,uuid,timestamptz,timestamptz,text,int,int) from public,anon; grant execute on function public.get_sold_products_register(uuid,text,text,text,uuid,timestamptz,timestamptz,text,int,int) to authenticated;
