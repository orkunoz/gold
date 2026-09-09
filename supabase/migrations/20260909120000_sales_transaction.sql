-- Gold Task 4A: immutable sales history and atomic sale completion.

create sequence public.sale_number_sequence;

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  sale_number text not null unique,
  sold_at timestamptz not null default now(),
  total_list_price numeric(14, 2),
  total_sale_price numeric(14, 2) not null,
  notes text,
  created_at timestamptz not null default now(),
  constraint sales_number_not_empty check (btrim(sale_number) <> ''),
  constraint sales_total_list_price_nonnegative check (total_list_price is null or total_list_price >= 0),
  constraint sales_total_sale_price_nonnegative check (total_sale_price >= 0),
  constraint sales_notes_not_empty check (notes is null or btrim(notes) <> '')
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete restrict,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  list_price numeric(14, 2),
  sale_price numeric(14, 2) not null,
  created_at timestamptz not null default now(),
  constraint sale_items_inventory_item_unique unique (inventory_item_id),
  constraint sale_items_list_price_nonnegative check (list_price is null or list_price >= 0),
  constraint sale_items_sale_price_nonnegative check (sale_price >= 0)
);

create index sales_shop_sold_at_idx on public.sales (shop_id, sold_at desc);
create index sales_employee_id_idx on public.sales (employee_id);
create index sale_items_sale_id_idx on public.sale_items (sale_id);

alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

revoke all on table public.sales from anon, authenticated;
revoke all on table public.sale_items from anon, authenticated;
revoke all on sequence public.sale_number_sequence from public, anon, authenticated;

grant select on table public.sales to authenticated;
grant select on table public.sale_items to authenticated;

create policy sales_select_accessible_shop on public.sales
for select to authenticated
using ((select public.can_access_shop(shop_id)));

create policy sale_items_select_accessible_shop on public.sale_items
for select to authenticated
using (
  exists (
    select 1
    from public.sales as sale
    where sale.id = sale_items.sale_id
      and (select public.can_access_shop(sale.shop_id))
  )
);

create or replace function public.complete_sale(
  p_shop_id uuid,
  p_items jsonb,
  p_notes text default null
)
returns table (
  sale_id uuid,
  sale_number text,
  sold_at timestamptz,
  total_sale_price numeric,
  item_count integer
)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_employee public.employees%rowtype;
  v_sale_id uuid;
  v_sale_number text;
  v_sold_at timestamptz;
  v_total_list_price numeric(14, 2);
  v_total_sale_price numeric(14, 2);
  v_item_count integer;
  v_distinct_item_count integer;
  v_locked_count integer := 0;
  v_inventory_item public.inventory_items%rowtype;
  v_notes text;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select employee.*
  into v_employee
  from public.employees as employee
  where employee.auth_user_id = (select auth.uid())
    and employee.is_active
  limit 1;

  if not found or v_employee.role not in ('owner', 'manager', 'salesperson') then
    raise exception using errcode = '42501', message = 'An active employee account is required.';
  end if;

  if not exists (
    select 1 from public.shops as shop
    where shop.id = p_shop_id and shop.is_active
  ) then
    raise exception using errcode = '22023', message = 'Select an active shop.';
  end if;

  if v_employee.role <> 'owner' and v_employee.shop_id is distinct from p_shop_id then
    raise exception using errcode = '42501', message = 'You cannot complete a sale for this shop.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = '22023', message = 'At least one sale item is required.';
  end if;

  if jsonb_array_length(p_items) > 100 then
    raise exception using errcode = '22023', message = 'A sale cannot contain more than 100 items.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as requested(item)
    where jsonb_typeof(requested.item) <> 'object'
      or not (requested.item ? 'inventory_item_id')
      or not (requested.item ? 'sale_price')
      or jsonb_typeof(requested.item -> 'inventory_item_id') <> 'string'
      or jsonb_typeof(requested.item -> 'sale_price') <> 'number'
      or requested.item - 'inventory_item_id' - 'sale_price' <> '{}'::jsonb
  ) then
    raise exception using errcode = '22023', message = 'Each sale item must contain only inventory_item_id and sale_price.';
  end if;

  begin
    select
      count(*)::integer,
      count(distinct (requested.item ->> 'inventory_item_id')::uuid)::integer
    into v_item_count, v_distinct_item_count
    from jsonb_array_elements(p_items) as requested(item);
  exception when invalid_text_representation then
    raise exception using errcode = '22023', message = 'Every inventory_item_id must be a valid UUID.';
  end;

  if v_item_count <> v_distinct_item_count then
    raise exception using errcode = '22023', message = 'The same inventory item cannot appear twice in one sale.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as requested(item)
    where (requested.item ->> 'sale_price')::numeric < 0
      or (requested.item ->> 'sale_price')::numeric > 999999999999.99
  ) then
    raise exception using errcode = '22023', message = 'Sale prices must be non-negative and within the supported range.';
  end if;

  -- Lock in UUID order to serialize competing cashiers and avoid lock-order deadlocks.
  for v_inventory_item in
    select inventory.*
    from public.inventory_items as inventory
    join jsonb_array_elements(p_items) as requested(item)
      on inventory.id = (requested.item ->> 'inventory_item_id')::uuid
    order by inventory.id
    for update of inventory
  loop
    v_locked_count := v_locked_count + 1;
    if v_inventory_item.shop_id <> p_shop_id then
      raise exception using errcode = '22023', message = 'An inventory item does not belong to the sale shop.';
    end if;
    if v_inventory_item.status <> 'IN_STOCK' then
      raise exception using errcode = '22023', message = 'Every inventory item must be IN_STOCK.';
    end if;
  end loop;

  if v_locked_count <> v_item_count then
    raise exception using errcode = '22023', message = 'One or more inventory items do not exist.';
  end if;

  v_notes := nullif(btrim(p_notes), '');
  if length(v_notes) > 5000 then
    raise exception using errcode = '22023', message = 'Sale notes cannot exceed 5000 characters.';
  end if;

  v_sale_number := 'SALE-' || to_char(statement_timestamp() at time zone 'UTC', 'YYYYMMDD')
    || '-' || lpad(nextval('public.sale_number_sequence'::regclass)::text, 6, '0');

  insert into public.sales (shop_id, employee_id, sale_number, total_sale_price, notes)
  values (p_shop_id, v_employee.id, v_sale_number, 0, v_notes)
  returning id, public.sales.sold_at into v_sale_id, v_sold_at;

  insert into public.sale_items (sale_id, inventory_item_id, list_price, sale_price)
  select
    v_sale_id,
    inventory.id,
    coalesce(inventory.selling_price, inventory.owner_price),
    (requested.item ->> 'sale_price')::numeric(14, 2)
  from jsonb_array_elements(p_items) as requested(item)
  join public.inventory_items as inventory
    on inventory.id = (requested.item ->> 'inventory_item_id')::uuid;

  select sum(item.list_price), sum(item.sale_price)
  into v_total_list_price, v_total_sale_price
  from public.sale_items as item
  where item.sale_id = v_sale_id;

  update public.sales
  set total_list_price = v_total_list_price,
      total_sale_price = v_total_sale_price
  where id = v_sale_id;

  update public.inventory_items as inventory
  set status = 'SOLD'
  where inventory.id in (
    select (requested.item ->> 'inventory_item_id')::uuid
    from jsonb_array_elements(p_items) as requested(item)
  );

  return query
  select v_sale_id, v_sale_number, v_sold_at, v_total_sale_price::numeric, v_item_count;
end;
$$;

revoke all on function public.complete_sale(uuid, jsonb, text) from public, anon;
grant execute on function public.complete_sale(uuid, jsonb, text) to authenticated;

comment on table public.sales is 'Immutable sale headers created only by complete_sale.';
comment on table public.sale_items is 'Immutable sale line snapshots created only by complete_sale.';
comment on function public.complete_sale(uuid, jsonb, text) is
  'Atomically validates, records, and marks one or more physical inventory items SOLD.';
