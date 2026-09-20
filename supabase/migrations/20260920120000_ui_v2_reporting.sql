-- ZLATA UI V2 reporting periods, current inventory snapshot, and shop sparklines.
create or replace function public.get_dashboard_report(p_period text,p_shop_id uuid,p_start_date date,p_end_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
set row_security=off
as $$
declare
  e public.employees%rowtype;
  sid uuid;
  period text:=upper(coalesce(p_period,''));
  today date:=(statement_timestamp() at time zone 'Europe/Kyiv')::date;
  started timestamptz;
  ended timestamptz;
  use_months boolean;
  k jsonb; inv jsonb; statuses jsonb; recent jsonb; trend jsonb; categories jsonb; shops_report jsonb;
begin
  select x.* into e from public.employees x where x.auth_user_id=(select auth.uid()) and x.is_active limit 1;
  if not found or e.role not in('owner','salesperson') then
    raise exception using errcode='42501',message='An active employee account is required.';
  end if;

  if e.role='owner' then
    sid:=p_shop_id;
    if sid is not null and not exists(select 1 from public.shops where id=sid and is_active and location_type='SHOP') then
      raise exception using errcode='42501',message='You cannot report on this shop.';
    end if;
  else
    if e.shop_id is null or not exists(select 1 from public.shops where id=e.shop_id and is_active and location_type='SHOP') then
      raise exception using errcode='42501',message='An active assigned shop is required.';
    end if;
    if p_shop_id is not null and p_shop_id<>e.shop_id then
      raise exception using errcode='42501',message='You cannot report on another shop.';
    end if;
    sid:=e.shop_id;
  end if;

  if period='TODAY' then
    started:=today::timestamp at time zone 'Europe/Kyiv'; ended:=(today+1)::timestamp at time zone 'Europe/Kyiv';
  elsif period='LAST_7_DAYS' then
    started:=(today-6)::timestamp at time zone 'Europe/Kyiv'; ended:=(today+1)::timestamp at time zone 'Europe/Kyiv';
  elsif period='LAST_30_DAYS' then
    started:=(today-29)::timestamp at time zone 'Europe/Kyiv'; ended:=(today+1)::timestamp at time zone 'Europe/Kyiv';
  elsif period='THIS_MONTH' then
    started:=date_trunc('month',today::timestamp) at time zone 'Europe/Kyiv'; ended:=(today+1)::timestamp at time zone 'Europe/Kyiv';
  elsif period='LAST_MONTH' then
    started:=(date_trunc('month',today::timestamp)-interval '1 month') at time zone 'Europe/Kyiv'; ended:=date_trunc('month',today::timestamp) at time zone 'Europe/Kyiv';
  elsif period='ALL_TIME' then
    select coalesce(date_trunc('day',min(s.sold_at) at time zone 'Europe/Kyiv') at time zone 'Europe/Kyiv',today::timestamp at time zone 'Europe/Kyiv') into started
      from public.sales s where sid is null or s.shop_id=sid;
    ended:=(today+1)::timestamp at time zone 'Europe/Kyiv';
  elsif period='CUSTOM' and p_start_date is not null and p_end_date is not null and p_start_date<=p_end_date and p_end_date<=today then
    started:=p_start_date::timestamp at time zone 'Europe/Kyiv'; ended:=(p_end_date+1)::timestamp at time zone 'Europe/Kyiv';
  else
    raise exception using errcode='22023',message='Select a supported reporting period.';
  end if;
  use_months:=ended-started>interval '93 days';

  select jsonb_build_object(
    'revenue',coalesce(sum(s.total_sale_price),0),
    'sales_count',count(*)::int,
    'items_sold',coalesce(sum(x.items),0)::int,
    'gold_weight_sold',coalesce(sum(x.weight),0),
    'average_sale',case when count(*)=0 then 0 else round(sum(s.total_sale_price)/count(*),2) end
  ) into k
  from public.sales s
  cross join lateral(select count(*) items,coalesce(sum(si.weight_grams),0) weight from public.sale_items si where si.sale_id=s.id)x
  where s.sold_at>=started and s.sold_at<ended and(sid is null or s.shop_id=sid);

  if e.role='owner' then
    -- Deliberately independent of period and selected selling shop; includes Warehouse.
    select jsonb_build_object(
      'in_stock_items',count(*)::int,
      'in_stock_weight',coalesce(sum(i.weight_grams),0),
      'customer_value',coalesce(sum(p.effective_price),0),
      'missing_price_items',count(*) filter(where p.effective_price is null)::int
    ) into inv
    from public.inventory_items i
    join public.shops sh on sh.id=i.shop_id and sh.is_active
    cross join lateral public.get_effective_inventory_price(i.id)p
    where i.status='IN_STOCK';

    select jsonb_build_object('IN_STOCK',count(*) filter(where status='IN_STOCK'),'SOLD',count(*) filter(where status='SOLD')) into statuses from public.inventory_items;

    if use_months then
      select coalesce(jsonb_agg(jsonb_build_object('date',d.bucket::date,'revenue',coalesce(t.revenue,0),'items_sold',coalesce(t.items_sold,0)) order by d.bucket),'[]') into trend
      from generate_series(date_trunc('month',started at time zone 'Europe/Kyiv'),date_trunc('month',(ended-interval '1 second') at time zone 'Europe/Kyiv'),interval '1 month')d(bucket)
      left join(select date_trunc('month',s.sold_at at time zone 'Europe/Kyiv') bucket,sum(si.sale_price) revenue,count(si.id)::int items_sold from public.sales s join public.sale_items si on si.sale_id=s.id where s.sold_at>=started and s.sold_at<ended and(sid is null or s.shop_id=sid) group by 1)t on t.bucket=d.bucket;
    else
      select coalesce(jsonb_agg(jsonb_build_object('date',d.bucket::date,'revenue',coalesce(t.revenue,0),'items_sold',coalesce(t.items_sold,0)) order by d.bucket),'[]') into trend
      from generate_series((started at time zone 'Europe/Kyiv')::date,(ended at time zone 'Europe/Kyiv')::date-1,interval '1 day')d(bucket)
      left join(select date_trunc('day',s.sold_at at time zone 'Europe/Kyiv') bucket,sum(si.sale_price) revenue,count(si.id)::int items_sold from public.sales s join public.sale_items si on si.sale_id=s.id where s.sold_at>=started and s.sold_at<ended and(sid is null or s.shop_id=sid) group by 1)t on t.bucket=d.bucket;
    end if;

    select coalesce(jsonb_agg(row_data order by(row_data->>'revenue')::numeric desc),'[]') into categories
    from(select jsonb_build_object('category',coalesce(si.category_name,'Uncategorized'),'items_sold',count(*)::int,'revenue',coalesce(sum(si.sale_price),0),'weight_sold',coalesce(sum(si.weight_grams),0))row_data
      from public.sale_items si join public.sales s on s.id=si.sale_id
      where s.sold_at>=started and s.sold_at<ended and(sid is null or s.shop_id=sid)
      group by coalesce(si.category_name,'Uncategorized'))q;

    select coalesce(jsonb_agg(row_data order by(row_data->>'revenue')::numeric desc),'[]') into shops_report
    from(select jsonb_build_object(
      'shop_id',sh.id,'shop',sh.name,'revenue',coalesce(sd.revenue,0),'sales_count',coalesce(sd.sales_count,0),
      'items_sold',coalesce(sd.items,0),'weight_sold',coalesce(sd.weight,0),'in_stock_items',coalesce(st.items,0),
      'in_stock_weight',coalesce(st.weight,0),'inventory_value',coalesce(st.value,0),'trend',coalesce(sp.values,'[]'::jsonb)
    )row_data
    from public.shops sh
    left join lateral(select sum(si.sale_price)revenue,count(distinct s.id)::int sales_count,count(si.id)::int items,coalesce(sum(si.weight_grams),0)weight from public.sales s left join public.sale_items si on si.sale_id=s.id where s.shop_id=sh.id and s.sold_at>=started and s.sold_at<ended)sd on true
    left join lateral(select count(*)::int items,coalesce(sum(i.weight_grams),0)weight,coalesce(sum(p.effective_price),0)value from public.inventory_items i cross join lateral public.get_effective_inventory_price(i.id)p where i.shop_id=sh.id and i.status='IN_STOCK')st on true
    left join lateral(select jsonb_agg(q.revenue order by q.bucket) values from(select case when use_months then date_trunc('month',s.sold_at at time zone 'Europe/Kyiv') else date_trunc('day',s.sold_at at time zone 'Europe/Kyiv') end bucket,coalesce(sum(si.sale_price),0) revenue from public.sales s join public.sale_items si on si.sale_id=s.id where s.shop_id=sh.id and s.sold_at>=started and s.sold_at<ended group by 1)q)sp on true
    where sh.is_active and sh.location_type='SHOP' and(sid is null or sh.id=sid))q;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'sale_number',s.sale_number,'sold_at',s.sold_at,'shop',coalesce(sh.name,s.shop_name,'Deleted shop'),
    'employee',coalesce(emp.username,s.employee_username,emp.full_name,s.employee_name,'Deleted account'),
    'item_count',x.items,'category_summary',x.category_summary,'total_sale_price',s.total_sale_price
  )order by s.sold_at desc),'[]') into recent
  from(select * from public.sales where sold_at>=started and sold_at<ended and(sid is null or shop_id=sid) order by sold_at desc limit 10)s
  left join public.shops sh on sh.id=s.shop_id
  left join public.employees emp on emp.id=s.employee_id
  cross join lateral(select sum(c.category_count)::int items,string_agg(case when c.category_count=1 then c.category else c.category||' × '||c.category_count end,', ' order by c.category)category_summary from(select coalesce(si.category_name,'Uncategorized')category,count(*)::int category_count from public.sale_items si where si.sale_id=s.id group by coalesce(si.category_name,'Uncategorized'))c)x;

  return jsonb_build_object('role',e.role,'period',period,'timezone','Europe/Kyiv','start_at',started,'end_at',ended,'shop_id',sid,'kpis',k,'inventory',inv,'status_counts',statuses,'recent_sales',recent,'sales_over_time',trend,'categories',categories,'shops',shops_report);
end
$$;

revoke all on function public.get_dashboard_report(text,uuid,date,date) from public,anon;
grant execute on function public.get_dashboard_report(text,uuid,date,date) to authenticated;

create or replace function public.get_dashboard_report(p_period text default 'THIS_MONTH',p_shop_id uuid default null)
returns jsonb language sql stable security definer set search_path='' set row_security=off
as $$select public.get_dashboard_report(p_period,p_shop_id,null,null)$$;
revoke all on function public.get_dashboard_report(text,uuid) from public,anon;
grant execute on function public.get_dashboard_report(text,uuid) to authenticated;

create or replace function public.get_net_profit_report(p_period text,p_shop_id uuid,p_start_date date,p_end_date date)
returns jsonb language plpgsql stable security definer set search_path='' set row_security=off as $$
declare e public.employees%rowtype;sid uuid;period text:=upper(coalesce(p_period,''));today date:=(statement_timestamp()at time zone 'Europe/Kyiv')::date;started timestamptz;ended timestamptz;result jsonb;
begin
  select x.* into e from public.employees x where x.auth_user_id=(select auth.uid())and x.is_active limit 1;
  if not found or e.role<>'owner' then raise exception using errcode='42501',message='Owner access is required.';end if;
  sid:=p_shop_id;
  if sid is not null and not exists(select 1 from public.shops where id=sid and is_active and location_type='SHOP') then raise exception using errcode='42501',message='You cannot report on this shop.';end if;
  if period='TODAY' then started:=today::timestamp at time zone 'Europe/Kyiv';ended:=(today+1)::timestamp at time zone 'Europe/Kyiv';
  elsif period='LAST_7_DAYS' then started:=(today-6)::timestamp at time zone 'Europe/Kyiv';ended:=(today+1)::timestamp at time zone 'Europe/Kyiv';
  elsif period='LAST_30_DAYS' then started:=(today-29)::timestamp at time zone 'Europe/Kyiv';ended:=(today+1)::timestamp at time zone 'Europe/Kyiv';
  elsif period='THIS_MONTH' then started:=date_trunc('month',today::timestamp)at time zone 'Europe/Kyiv';ended:=(today+1)::timestamp at time zone 'Europe/Kyiv';
  elsif period='LAST_MONTH' then started:=(date_trunc('month',today::timestamp)-interval '1 month')at time zone 'Europe/Kyiv';ended:=date_trunc('month',today::timestamp)at time zone 'Europe/Kyiv';
  elsif period='ALL_TIME' then select coalesce(date_trunc('day',min(s.sold_at)at time zone 'Europe/Kyiv')at time zone 'Europe/Kyiv',today::timestamp at time zone 'Europe/Kyiv')into started from public.sales s where sid is null or s.shop_id=sid;ended:=(today+1)::timestamp at time zone 'Europe/Kyiv';
  elsif period='CUSTOM' and p_start_date is not null and p_end_date is not null and p_start_date<=p_end_date and p_end_date<=today then started:=p_start_date::timestamp at time zone 'Europe/Kyiv';ended:=(p_end_date+1)::timestamp at time zone 'Europe/Kyiv';
  else raise exception using errcode='22023',message='Select a supported reporting period.';end if;
  select jsonb_build_object('net_profit',coalesce(sum(si.sale_price-coalesce(si.purchase_price_snapshot,0)),0),'missing_purchase_cost_items',count(*)filter(where si.purchase_price_snapshot is null)::int)
  into result from public.sale_items si join public.sales s on s.id=si.sale_id
  where s.sold_at>=started and s.sold_at<ended and(sid is null or s.shop_id=sid);
  return result;
end $$;
revoke all on function public.get_net_profit_report(text,uuid,date,date) from public,anon;
grant execute on function public.get_net_profit_report(text,uuid,date,date) to authenticated;

comment on function public.get_dashboard_report(text,uuid,date,date) is 'ZLATA V2 role-scoped dashboard; global Kyiv range, current inventory snapshot, selling-shop trends.';
comment on function public.get_net_profit_report(text,uuid,date,date) is 'Owner-only aggregate net profit for ZLATA V2 periods without exposing purchase-cost rows.';
