-- Task 12: username accounts, three-state inventory, and role-scoped dashboard periods.

alter table public.employees add column if not exists username text;
update public.employees set username=lower(btrim(username)) where username is not null;
alter table public.employees drop constraint if exists employees_username_valid;
alter table public.employees add constraint employees_username_valid check (
  username is null or (username=lower(btrim(username)) and username ~ '^[a-z0-9][a-z0-9_-]{2,31}$')
);
create unique index if not exists employees_username_unique on public.employees(username) where username is not null;

update public.inventory_items set status='IN_STOCK' where status='RESERVED';
alter table public.inventory_items drop constraint if exists inventory_items_status_check;
alter table public.inventory_items add constraint inventory_items_status_check check(status in ('IN_STOCK','SOLD','REMOVED'));

create or replace function public.admin_set_shop_active(p_shop_id uuid,p_active boolean) returns void language plpgsql security definer set search_path='' set row_security=off as $$
begin perform public.require_owner_employee(); if not p_active then if exists(select 1 from public.employees where shop_id=p_shop_id and is_active) then raise exception using errcode='22023',message='Deactivate or reassign active employees first.'; end if; if exists(select 1 from public.inventory_items where shop_id=p_shop_id and status='IN_STOCK') then raise exception using errcode='22023',message='A shop with in-stock inventory cannot be deactivated.'; end if; end if; update public.shops set is_active=p_active where id=p_shop_id; if not found then raise exception using errcode='22023',message='Shop not found.'; end if; end $$;

create or replace function public.admin_link_employee_account(p_auth_user_id uuid,p_username text,p_full_name text,p_role text,p_shop_id uuid)
returns uuid language plpgsql security definer set search_path='' set row_security=off as $$
declare v_username text:=lower(btrim(p_username));v_id uuid;v_email text;
begin
  perform public.require_owner_employee();
  if v_username !~ '^[a-z0-9][a-z0-9_-]{2,31}$' or btrim(coalesce(p_full_name,''))='' then raise exception using errcode='22023',message='Invalid account details.'; end if;
  if p_role<>'salesperson' then raise exception using errcode='22023',message='Routine account creation supports Salesperson only.'; end if;
  perform public.validate_admin_employee(p_role,p_shop_id,true);
  select lower(btrim(email)) into v_email from auth.users where id=p_auth_user_id;
  if v_email is distinct from v_username||'@internal.local' then raise exception using errcode='42501',message='Auth identity does not match username.'; end if;
  select id into v_id from public.employees where auth_user_id=p_auth_user_id or username=v_username for update;
  if found then
    update public.employees set auth_user_id=p_auth_user_id,email=v_email,username=v_username,full_name=btrim(p_full_name),role='salesperson',shop_id=p_shop_id,is_active=true where id=v_id;
  else
    insert into public.employees(auth_user_id,email,username,full_name,role,shop_id,is_active) values(p_auth_user_id,v_email,v_username,btrim(p_full_name),'salesperson',p_shop_id,true) returning id into v_id;
  end if;
  return v_id;
end $$;
revoke all on function public.admin_link_employee_account(uuid,text,text,text,uuid) from public,anon;
grant execute on function public.admin_link_employee_account(uuid,text,text,text,uuid) to authenticated;

create or replace function public.get_dashboard_report(p_period text default 'THIS_MONTH',p_shop_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' set row_security=off as $$
declare e public.employees%rowtype;sid uuid;period text:=upper(coalesce(p_period,''));today date:=(statement_timestamp() at time zone 'Europe/Kyiv')::date;started timestamptz;ended timestamptz;k jsonb;inv jsonb;statuses jsonb;recent jsonb;trend jsonb;categories jsonb;shops_report jsonb;
begin
  select x.* into e from public.employees x where x.auth_user_id=(select auth.uid()) and x.is_active limit 1;
  if not found or e.role not in ('owner','salesperson') then raise exception using errcode='42501',message='An active employee account is required.'; end if;
  if e.role='owner' then sid:=p_shop_id;if sid is not null and not exists(select 1 from public.shops where id=sid and is_active) then raise exception using errcode='42501',message='You cannot report on this shop.';end if;
  else if e.shop_id is null or not exists(select 1 from public.shops where id=e.shop_id and is_active) then raise exception using errcode='42501',message='An active assigned shop is required.';end if;if p_shop_id is not null and p_shop_id<>e.shop_id then raise exception using errcode='42501',message='You cannot report on another shop.';end if;sid:=e.shop_id;end if;
  if period='TODAY' then started:=today::timestamp at time zone 'Europe/Kyiv';elsif period='LAST_7_DAYS' then started:=(today-6)::timestamp at time zone 'Europe/Kyiv';elsif period='THIS_MONTH' then started:=date_trunc('month',today::timestamp) at time zone 'Europe/Kyiv';elsif period='LAST_30_DAYS' then started:=(today-29)::timestamp at time zone 'Europe/Kyiv';else raise exception using errcode='22023',message='Select a supported reporting period.';end if;ended:=(today+1)::timestamp at time zone 'Europe/Kyiv';
  select jsonb_build_object('revenue',coalesce(sum(s.total_sale_price),0),'sales_count',count(*)::int,'items_sold',coalesce(sum(x.items),0)::int,'gold_weight_sold',coalesce(sum(x.weight),0),'average_sale',case when count(*)=0 then 0 else round(sum(s.total_sale_price)/count(*),2) end) into k from public.sales s cross join lateral(select count(*) items,coalesce(sum(i.weight_grams),0) weight from public.sale_items si join public.inventory_items i on i.id=si.inventory_item_id where si.sale_id=s.id)x where s.sold_at>=started and s.sold_at<ended and(sid is null or s.shop_id=sid);
  if e.role='owner' then
    select jsonb_build_object('in_stock_items',count(*)::int,'in_stock_weight',coalesce(sum(i.weight_grams),0),'customer_value',coalesce(sum(p.effective_price),0),'missing_price_items',count(*)filter(where p.effective_price is null)::int) into inv from public.inventory_items i join public.shops sh on sh.id=i.shop_id and sh.is_active cross join lateral public.get_effective_inventory_price(i.id)p where i.status='IN_STOCK' and(sid is null or i.shop_id=sid);
    select jsonb_build_object('IN_STOCK',count(*)filter(where status='IN_STOCK'),'SOLD',count(*)filter(where status='SOLD'),'REMOVED',count(*)filter(where status='REMOVED')) into statuses from public.inventory_items where sid is null or shop_id=sid;
    select coalesce(jsonb_agg(jsonb_build_object('date',d.report_day,'revenue',coalesce(t.revenue,0),'sales_count',coalesce(t.sales_count,0))order by d.report_day),'[]') into trend from generate_series((started at time zone 'Europe/Kyiv')::date,(ended at time zone 'Europe/Kyiv')::date-1,interval '1 day')d(report_day) left join(select(sold_at at time zone 'Europe/Kyiv')::date report_day,sum(total_sale_price)revenue,count(*)sales_count from public.sales where sold_at>=started and sold_at<ended and(sid is null or shop_id=sid)group by 1)t on t.report_day=d.report_day;
    select coalesce(jsonb_agg(row_data order by(row_data->>'revenue')::numeric desc),'[]')into categories from(select jsonb_build_object('category',coalesce(c.name,'Uncategorized'),'items_sold',count(*)::int,'revenue',coalesce(sum(si.sale_price),0),'weight_sold',coalesce(sum(i.weight_grams),0))row_data from public.sale_items si join public.sales s on s.id=si.sale_id join public.inventory_items i on i.id=si.inventory_item_id left join public.product_categories c on c.id=i.category_id where s.sold_at>=started and s.sold_at<ended and(sid is null or s.shop_id=sid)group by coalesce(c.name,'Uncategorized'))q;
    if sid is null then select coalesce(jsonb_agg(row_data order by(row_data->>'revenue')::numeric desc),'[]')into shops_report from(select jsonb_build_object('shop_id',sh.id,'shop',sh.name,'revenue',coalesce(sd.revenue,0),'sales_count',coalesce(sd.sales_count,0),'items_sold',coalesce(sd.items,0),'weight_sold',coalesce(sd.weight,0),'in_stock_items',coalesce(st.items,0),'in_stock_weight',coalesce(st.weight,0),'inventory_value',coalesce(st.value,0))row_data from public.shops sh left join lateral(select sum(s.total_sale_price)revenue,count(distinct s.id)::int sales_count,count(si.id)::int items,coalesce(sum(i.weight_grams),0)weight from public.sales s left join public.sale_items si on si.sale_id=s.id left join public.inventory_items i on i.id=si.inventory_item_id where s.shop_id=sh.id and s.sold_at>=started and s.sold_at<ended)sd on true left join lateral(select count(*)::int items,coalesce(sum(i.weight_grams),0)weight,coalesce(sum(p.effective_price),0)value from public.inventory_items i cross join lateral public.get_effective_inventory_price(i.id)p where i.shop_id=sh.id and i.status='IN_STOCK')st on true where sh.is_active)q;end if;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'sale_number',s.sale_number,'sold_at',s.sold_at,'shop',sh.name,'employee',coalesce(emp.full_name,'Staff member'),'item_count',x.items,'total_sale_price',s.total_sale_price)order by s.sold_at desc),'[]')into recent from(select * from public.sales where(sid is null or shop_id=sid)order by sold_at desc limit 10)s join public.shops sh on sh.id=s.shop_id join public.employees emp on emp.id=s.employee_id cross join lateral(select count(*)::int items from public.sale_items where sale_id=s.id)x;
  return jsonb_build_object('role',e.role,'period',period,'timezone','Europe/Kyiv','start_at',started,'end_at',ended,'shop_id',sid,'kpis',k,'inventory',inv,'status_counts',statuses,'recent_sales',recent,'sales_over_time',trend,'categories',categories,'shops',shops_report,'employees',null);
end $$;
revoke all on function public.get_dashboard_report(text,uuid) from public,anon;
grant execute on function public.get_dashboard_report(text,uuid) to authenticated;

comment on column public.employees.username is 'Normalized operational login name; Auth uses a deterministic internal email alias.';
comment on function public.admin_link_employee_account(uuid,text,text,text,uuid) is 'Owner-only idempotent link between an Auth user and one Salesperson employee record.';
