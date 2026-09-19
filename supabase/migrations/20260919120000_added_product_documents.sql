-- Immutable Owner-only goods receipt notes created atomically with manual Add Products batches.
create table public.added_product_documents(
  id uuid primary key default gen_random_uuid(),
  document_number text not null unique,
  created_at timestamptz not null default now(),
  created_by_employee_id uuid references public.employees(id) on delete set null,
  created_by_name text not null,
  location_names text[] not null,
  product_count integer not null check(product_count > 0),
  total_weight numeric(16,3) not null,
  total_purchase_value numeric(16,2) not null,
  total_value numeric(16,2) not null
);

create table public.added_product_document_items(
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.added_product_documents(id) on delete cascade,
  line_number integer not null,
  inventory_item_id uuid,
  category_name text not null,
  article_number text,
  producer text not null,
  size text,
  weight_grams numeric not null,
  purchase_price numeric(14,2),
  price_per_gram numeric(14,2) not null,
  price numeric(14,2) not null,
  status text not null,
  location_id uuid,
  location_name text not null,
  barcode text,
  product_created_at timestamptz not null,
  unique(document_id,line_number)
);

alter table public.added_product_documents enable row level security;
alter table public.added_product_document_items enable row level security;
create policy added_product_documents_owner_read on public.added_product_documents for select to authenticated using(public.is_owner());
create policy added_product_document_items_owner_read on public.added_product_document_items for select to authenticated using(public.is_owner());
revoke all on public.added_product_documents,public.added_product_document_items from public,anon,authenticated;
grant select on public.added_product_documents,public.added_product_document_items to authenticated;
create sequence public.added_product_document_number_seq;

drop function public.create_inventory_items_batch(jsonb);
create function public.create_inventory_items_batch(p_items jsonb)
returns jsonb language plpgsql security definer set search_path = '' set row_security = off
as $$
declare
  v_employee public.employees%rowtype; v_item jsonb; v_row integer := 0; v_document_id uuid;
  v_inventory_id uuid; v_category_id uuid; v_location_name text;
  v_barcode text; v_shop_id uuid; v_category text; v_producer text; v_weight numeric; v_rate numeric; v_purchase numeric;
begin
  v_employee := public.require_owner_employee();
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then
    raise exception using errcode = '22023', message = 'Batch must contain 1 to 100 products.';
  end if;
  insert into public.added_product_documents(document_number,created_by_employee_id,created_by_name,location_names,product_count,total_weight,total_purchase_value,total_value)
  values('GR-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'||lpad(nextval('public.added_product_document_number_seq')::text,6,'0'),v_employee.id,
    coalesce(v_employee.full_name,v_employee.username,'Owner'),'{}',jsonb_array_length(p_items),0,0,0)
  returning id into v_document_id;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_row := v_row + 1;
    begin
      v_barcode := nullif(btrim(v_item->>'barcode'), '');
      v_shop_id := nullif(btrim(v_item->>'shop_id'), '')::uuid;
      v_category := nullif(regexp_replace(btrim(v_item->>'category_name'), '\s+', ' ', 'g'), '');
      v_producer := nullif(btrim(v_item->>'producer'), '');
      v_weight := nullif(v_item->>'weight_grams', '')::numeric;
      v_rate := nullif(v_item->>'price_per_gram', '')::numeric;
      v_purchase := nullif(v_item->>'purchase_price','')::numeric;
      if v_category is null or v_producer is null or v_weight is null or v_weight <= 0 or v_rate is null or v_rate <= 0 then
        raise exception using errcode = '22023', message = 'Category, producer, positive weight, and positive price per gram are required.';
      end if;
      select name into v_location_name from public.shops where id = v_shop_id and is_active;
      if not found then raise exception using errcode = '22023', message = 'Select a valid active location.'; end if;
      if v_barcode is not null and exists(select 1 from public.inventory_items where barcode = v_barcode) then
        raise exception using errcode = '23505', message = format('barcode %s already exists.', v_barcode);
      end if;
      v_category_id := public.resolve_product_category(v_category);
      insert into public.inventory_items(shop_id,barcode,article_number,category_id,producer,size,weight_grams,purchase_price,price_per_gram,status,created_by)
      values(v_shop_id,v_barcode,nullif(btrim(v_item->>'article_number'),''),v_category_id,v_producer,nullif(btrim(v_item->>'size'),''),v_weight,v_purchase,v_rate,'IN_STOCK',v_employee.id)
      returning id into v_inventory_id;
      insert into public.added_product_document_items(document_id,line_number,inventory_item_id,category_name,article_number,producer,size,weight_grams,purchase_price,price_per_gram,price,status,location_id,location_name,barcode,product_created_at)
      select v_document_id,v_row,i.id,c.name,i.article_number,i.producer,i.size,i.weight_grams,i.purchase_price,i.price_per_gram,i.price,i.status,i.shop_id,v_location_name,i.barcode,i.created_at
      from public.inventory_items i join public.product_categories c on c.id=i.category_id where i.id=v_inventory_id;
    exception when others then
      raise exception using errcode = sqlstate, message = format('Row %s: %s', v_row, sqlerrm);
    end;
  end loop;
  update public.added_product_documents d set
    location_names=(select array_agg(distinct i.location_name order by i.location_name) from public.added_product_document_items i where i.document_id=d.id),
    total_weight=(select coalesce(sum(i.weight_grams),0) from public.added_product_document_items i where i.document_id=d.id),
    total_purchase_value=(select coalesce(sum(i.purchase_price),0) from public.added_product_document_items i where i.document_id=d.id),
    total_value=(select coalesce(sum(i.price),0) from public.added_product_document_items i where i.document_id=d.id)
  where d.id=v_document_id;
  return jsonb_build_object('count',v_row,'document_id',v_document_id);
end $$;
revoke all on function public.create_inventory_items_batch(jsonb) from public, anon;
grant execute on function public.create_inventory_items_batch(jsonb) to authenticated;

comment on table public.added_product_documents is 'Immutable Owner-only headers for successful manual Add Products batches.';
comment on table public.added_product_document_items is 'Immutable product snapshots captured atomically with manual batch creation.';
