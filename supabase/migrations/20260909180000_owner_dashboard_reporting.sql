-- Task 6: role-scoped business reporting in the Europe/Kyiv business timezone.

create or replace function public.get_dashboard_report(
  p_period text default 'THIS_MONTH',
  p_shop_id uuid default null
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
  v_effective_shop uuid;
  v_period text:=upper(coalesce(p_period,''));
  v_local_today date:=(statement_timestamp() at time zone 'Europe/Kyiv')::date;
  v_start timestamptz;
  v_end timestamptz;
  v_kpis jsonb; v_inventory jsonb; v_status jsonb; v_recent jsonb;
  v_trend jsonb; v_categories jsonb; v_shops jsonb; v_employees jsonb;
begin
  select employee.* into v_employee from public.employees employee
  where employee.auth_user_id=(select auth.uid()) and employee.is_active limit 1;
  if not found or v_employee.role not in ('owner','manager','salesperson') then
    raise exception using errcode='42501',message='An active employee account is required.';
  end if;

  if v_employee.role='owner' then
    v_effective_shop:=p_shop_id;
    if p_shop_id is not null and (not public.can_access_shop(p_shop_id) or not exists(select 1 from public.shops where id=p_shop_id and is_active)) then
      raise exception using errcode='42501',message='You cannot report on this shop.';
    end if;
  else
    if v_employee.shop_id is null or not exists(select 1 from public.shops where id=v_employee.shop_id and is_active) then
      raise exception using errcode='42501',message='An active assigned shop is required.';
    end if;
    if p_shop_id is not null and p_shop_id<>v_employee.shop_id then
      raise exception using errcode='42501',message='You cannot report on another shop.';
    end if;
    v_effective_shop:=v_employee.shop_id;
  end if;

  if v_employee.role='salesperson' then v_period:='TODAY'; end if;
  if v_period='TODAY' then
    v_start:=v_local_today::timestamp at time zone 'Europe/Kyiv';
  elsif v_period='LAST_7_DAYS' then
    v_start:=(v_local_today-6)::timestamp at time zone 'Europe/Kyiv';
  elsif v_period='THIS_MONTH' then
    v_start:=date_trunc('month',v_local_today::timestamp) at time zone 'Europe/Kyiv';
  elsif v_period='LAST_30_DAYS' then
    v_start:=(v_local_today-29)::timestamp at time zone 'Europe/Kyiv';
  else
    raise exception using errcode='22023',message='Select a supported reporting period.';
  end if;
  v_end:=(v_local_today+1)::timestamp at time zone 'Europe/Kyiv';

  select jsonb_build_object(
    'revenue',coalesce(sum(s.total_sale_price),0),'sales_count',count(*)::integer,
    'items_sold',coalesce(sum(x.item_count),0)::integer,'gold_weight_sold',coalesce(sum(x.weight),0),
    'average_sale',case when count(*)=0 then 0 else round(sum(s.total_sale_price)/count(*),2) end
  ) into v_kpis
  from public.sales s
  cross join lateral (select count(*) item_count,coalesce(sum(i.weight_grams),0) weight from public.sale_items si join public.inventory_items i on i.id=si.inventory_item_id where si.sale_id=s.id) x
  where s.sold_at>=v_start and s.sold_at<v_end and (v_effective_shop is null or s.shop_id=v_effective_shop);

  if v_employee.role='salesperson' then
    v_inventory:=null; v_status:=null; v_trend:=null; v_categories:=null; v_shops:=null; v_employees:=null;
  else
    select jsonb_build_object(
      'in_stock_items',count(*)::integer,'in_stock_weight',coalesce(sum(i.weight_grams),0),
      'customer_value',coalesce(sum(price.effective_price),0),'missing_price_items',count(*) filter(where price.effective_price is null)::integer
    ) into v_inventory
    from public.inventory_items i
    join public.shops active_shop on active_shop.id=i.shop_id and active_shop.is_active
    cross join lateral public.get_effective_inventory_price(i.id) price
    where i.status='IN_STOCK' and (v_effective_shop is null or i.shop_id=v_effective_shop);

    select jsonb_build_object(
      'IN_STOCK',count(*) filter(where i.status='IN_STOCK'),'RESERVED',count(*) filter(where i.status='RESERVED'),
      'SOLD',count(*) filter(where i.status='SOLD'),'REMOVED',count(*) filter(where i.status='REMOVED')
    ) into v_status from public.inventory_items i where v_effective_shop is null or i.shop_id=v_effective_shop;

    select coalesce(jsonb_agg(jsonb_build_object('date',days.report_day,'revenue',coalesce(t.revenue,0),'sales_count',coalesce(t.sales_count,0)) order by days.report_day),'[]'::jsonb)
    into v_trend
    from generate_series((v_start at time zone 'Europe/Kyiv')::date,(v_end at time zone 'Europe/Kyiv')::date-1,interval '1 day') days(report_day)
    left join (
      select (s.sold_at at time zone 'Europe/Kyiv')::date as sale_day,sum(s.total_sale_price) revenue,count(*) sales_count
      from public.sales s where s.sold_at>=v_start and s.sold_at<v_end and (v_effective_shop is null or s.shop_id=v_effective_shop)
      group by 1
    ) t on t.sale_day=days.report_day;

    select coalesce(jsonb_agg(row_data order by (row_data->>'revenue')::numeric desc),'[]'::jsonb) into v_categories from (
      select jsonb_build_object('category',coalesce(c.name,'Uncategorized'),'items_sold',count(*)::integer,
        'revenue',coalesce(sum(si.sale_price),0),'weight_sold',coalesce(sum(i.weight_grams),0)) row_data
      from public.sale_items si join public.sales s on s.id=si.sale_id join public.inventory_items i on i.id=si.inventory_item_id
      left join public.product_categories c on c.id=i.category_id
      where s.sold_at>=v_start and s.sold_at<v_end and (v_effective_shop is null or s.shop_id=v_effective_shop)
      group by coalesce(c.name,'Uncategorized')
    ) category_rows;

    select coalesce(jsonb_agg(row_data order by (row_data->>'revenue')::numeric desc),'[]'::jsonb) into v_employees from (
      select jsonb_build_object('employee',coalesce(e.full_name,'Staff member'),'shop',shop.name,'sales_count',count(distinct s.id)::integer,
        'items_sold',count(si.id)::integer,'revenue',coalesce(sum(si.sale_price),0),
        'average_sale',case when count(distinct s.id)=0 then 0 else round(sum(si.sale_price)/count(distinct s.id),2) end) row_data
      from public.sales s join public.employees e on e.id=s.employee_id join public.shops shop on shop.id=s.shop_id
      left join public.sale_items si on si.sale_id=s.id
      where s.sold_at>=v_start and s.sold_at<v_end and (v_effective_shop is null or s.shop_id=v_effective_shop)
      group by e.id,e.full_name,shop.name
    ) employee_rows;

    if v_employee.role='owner' and v_effective_shop is null then
      select coalesce(jsonb_agg(row_data order by (row_data->>'revenue')::numeric desc),'[]'::jsonb) into v_shops from (
        select jsonb_build_object('shop_id',shop.id,'shop',shop.name,
          'revenue',coalesce(sales_data.revenue,0),'sales_count',coalesce(sales_data.sales_count,0),'items_sold',coalesce(sales_data.items_sold,0),
          'weight_sold',coalesce(sales_data.weight_sold,0),'in_stock_items',coalesce(stock.items,0),
          'in_stock_weight',coalesce(stock.weight,0),'inventory_value',coalesce(stock.value,0)) row_data
        from public.shops shop
        left join lateral (
          select sum(s.total_sale_price) revenue,count(distinct s.id)::integer sales_count,count(si.id)::integer items_sold,coalesce(sum(i.weight_grams),0) weight_sold
          from public.sales s left join public.sale_items si on si.sale_id=s.id left join public.inventory_items i on i.id=si.inventory_item_id
          where s.shop_id=shop.id and s.sold_at>=v_start and s.sold_at<v_end
        ) sales_data on true
        left join lateral (
          select count(*)::integer items,coalesce(sum(i.weight_grams),0) weight,coalesce(sum(price.effective_price),0) value
          from public.inventory_items i cross join lateral public.get_effective_inventory_price(i.id) price
          where i.shop_id=shop.id and i.status='IN_STOCK'
        ) stock on true
        where shop.is_active
      ) shop_rows;
    else v_shops:=null; end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'sale_number',s.sale_number,'sold_at',s.sold_at,'shop',shop.name,
    'employee',coalesce(e.full_name,'Staff member'),'item_count',x.item_count,'total_sale_price',s.total_sale_price) order by s.sold_at desc),'[]'::jsonb)
  into v_recent from (
    select * from public.sales s where (v_effective_shop is null or s.shop_id=v_effective_shop) order by s.sold_at desc limit 10
  ) s join public.shops shop on shop.id=s.shop_id join public.employees e on e.id=s.employee_id
  cross join lateral (select count(*)::integer item_count from public.sale_items si where si.sale_id=s.id) x;

  return jsonb_build_object('role',v_employee.role,'period',v_period,'timezone','Europe/Kyiv','start_at',v_start,'end_at',v_end,
    'shop_id',v_effective_shop,'kpis',v_kpis,'inventory',v_inventory,'status_counts',v_status,'recent_sales',v_recent,
    'sales_over_time',v_trend,'categories',v_categories,'shops',v_shops,'employees',v_employees);
end;
$$;

revoke all on function public.get_dashboard_report(text,uuid) from public, anon;
grant execute on function public.get_dashboard_report(text,uuid) to authenticated;
comment on function public.get_dashboard_report(text,uuid) is 'Role-scoped dashboard aggregates using Europe/Kyiv reporting boundaries and immutable sales history.';
