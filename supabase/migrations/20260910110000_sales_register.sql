-- Task 9: role-scoped, paginated sales register with shop/category filters.

create index if not exists inventory_items_category_id_idx
  on public.inventory_items (category_id);

create or replace function public.get_sales_register(
  p_shop_id uuid default null,
  p_category_filter text default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_employee public.employees%rowtype;
  v_shop_id uuid;
  v_category_id uuid;
  v_uncategorized boolean := false;
  v_filter text := nullif(btrim(p_category_filter), '');
  v_count bigint;
  v_sales jsonb;
begin
  select employee.* into v_employee
  from public.employees employee
  where employee.auth_user_id = (select auth.uid()) and employee.is_active
  limit 1;
  if not found or v_employee.role not in ('owner','manager','salesperson') then
    raise exception using errcode='42501', message='An active employee account is required.';
  end if;

  if p_page is null or p_page < 1 or p_page_size is null or p_page_size < 1 or p_page_size > 100 then
    raise exception using errcode='22023', message='Select a valid sales register page.';
  end if;

  if v_employee.role = 'owner' then
    v_shop_id := p_shop_id;
    if v_shop_id is not null and not exists(select 1 from public.shops where id=v_shop_id) then
      raise exception using errcode='22023', message='Shop not found.';
    end if;
  else
    if v_employee.shop_id is null then
      raise exception using errcode='42501', message='An assigned shop is required.';
    end if;
    if p_shop_id is not null and p_shop_id is distinct from v_employee.shop_id then
      raise exception using errcode='42501', message='You cannot view another shop sales register.';
    end if;
    v_shop_id := v_employee.shop_id;
  end if;

  if upper(coalesce(v_filter,'')) = 'UNCATEGORIZED' then
    v_uncategorized := true;
  elsif v_filter is not null then
    begin
      v_category_id := v_filter::uuid;
    exception when invalid_text_representation then
      raise exception using errcode='22023', message='Select a valid product category.';
    end;
    if not exists(select 1 from public.product_categories where id=v_category_id) then
      raise exception using errcode='22023', message='Product category not found.';
    end if;
  end if;

  with filtered as (
    select sale.id
    from public.sales sale
    where (v_shop_id is null or sale.shop_id=v_shop_id)
      and (v_filter is null or exists(
        select 1
        from public.sale_items line
        join public.inventory_items item on item.id=line.inventory_item_id
        where line.sale_id=sale.id
          and ((v_uncategorized and item.category_id is null) or (not v_uncategorized and item.category_id=v_category_id))
      ))
  ) select count(*) into v_count from filtered;

  with filtered as (
    select sale.*
    from public.sales sale
    where (v_shop_id is null or sale.shop_id=v_shop_id)
      and (v_filter is null or exists(
        select 1
        from public.sale_items line
        join public.inventory_items item on item.id=line.inventory_item_id
        where line.sale_id=sale.id
          and ((v_uncategorized and item.category_id is null) or (not v_uncategorized and item.category_id=v_category_id))
      ))
    order by sale.sold_at desc, sale.id desc
    offset (p_page-1)*p_page_size limit p_page_size
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', sale.id,
    'sale_number', sale.sale_number,
    'sold_at', sale.sold_at,
    'shop', shop.name,
    'employee', coalesce(employee.full_name,'Staff member'),
    'item_count', items.item_count,
    'products', items.products,
    'total_sale_price', sale.total_sale_price
  ) order by sale.sold_at desc, sale.id desc), '[]'::jsonb)
  into v_sales
  from filtered sale
  join public.shops shop on shop.id=sale.shop_id
  join public.employees employee on employee.id=sale.employee_id
  cross join lateral (
    select count(*)::integer item_count,
      coalesce(jsonb_agg(jsonb_build_object('category', category_name, 'count', category_count) order by category_name),'[]'::jsonb) products
    from (
      select coalesce(category.name,'Uncategorized') category_name, count(*)::integer category_count
      from public.sale_items line
      join public.inventory_items item on item.id=line.inventory_item_id
      left join public.product_categories category on category.id=item.category_id
      where line.sale_id=sale.id
      group by coalesce(category.name,'Uncategorized')
    ) product_groups
  ) items;

  return jsonb_build_object('sales',v_sales,'count',v_count,'page',p_page,'page_size',p_page_size);
end;
$$;

revoke all on function public.get_sales_register(uuid,text,integer,integer) from public,anon;
grant execute on function public.get_sales_register(uuid,text,integer,integer) to authenticated;
comment on function public.get_sales_register(uuid,text,integer,integer) is
  'Role-scoped paginated sales headers with non-duplicating category existence filtering and full product summaries.';
