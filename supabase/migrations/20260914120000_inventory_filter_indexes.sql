-- Inventory list uses contains filters for barcode/article plus newest-first pagination.
create extension if not exists pg_trgm with schema extensions;

create index if not exists inventory_items_barcode_trgm_idx
  on public.inventory_items using gin (barcode extensions.gin_trgm_ops)
  where barcode is not null;

create index if not exists inventory_items_article_number_trgm_idx
  on public.inventory_items using gin (article_number extensions.gin_trgm_ops)
  where article_number is not null;

create index if not exists inventory_items_created_at_idx
  on public.inventory_items (created_at desc);

-- Administration needs only grouped counts, not every matching employee/item row.
create or replace function public.get_admin_shop_counts()
returns table(shop_id uuid, employee_count bigint, in_stock_count bigint)
language plpgsql stable security definer set search_path='' set row_security=off as $$
begin
  perform public.require_owner_employee();
  return query
  select s.id,
    count(distinct e.id),
    count(distinct i.id)
  from public.shops s
  left join public.employees e on e.shop_id=s.id
  left join public.inventory_items i on i.shop_id=s.id and i.status='IN_STOCK'
  group by s.id;
end $$;

revoke all on function public.get_admin_shop_counts() from public,anon;
grant execute on function public.get_admin_shop_counts() to authenticated;
comment on function public.get_admin_shop_counts() is 'Owner-only grouped account and in-stock counts for Administration.';
