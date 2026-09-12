-- Task 13: removable operational accounts/shops with immutable historical labels.

alter table public.sales add column shop_name text, add column employee_name text, add column employee_username text;
update public.sales s set shop_name=sh.name from public.shops sh where sh.id=s.shop_id;
update public.sales s set employee_name=coalesce(e.full_name,e.username,'Deleted account'),employee_username=e.username from public.employees e where e.id=s.employee_id;
alter table public.sales alter column shop_name set not null, alter column employee_name set not null;

create or replace function public.capture_sale_identity_snapshots() returns trigger language plpgsql set search_path='' as $$
begin
  select sh.name into new.shop_name from public.shops sh where sh.id=new.shop_id;
  select coalesce(e.full_name,e.username,'Deleted account'),e.username into new.employee_name,new.employee_username from public.employees e where e.id=new.employee_id;
  if new.shop_name is null or new.employee_name is null then raise exception using errcode='22023',message='Sale shop and account must exist.';end if;
  return new;
end $$;
create trigger sales_capture_identity_snapshots before insert on public.sales for each row execute function public.capture_sale_identity_snapshots();

alter table public.inventory_item_history add column changed_by_name text, add column changed_by_username text;
update public.inventory_item_history h set changed_by_name=coalesce(e.full_name,e.username),changed_by_username=e.username from public.employees e where e.id=h.changed_by_employee_id;
create or replace function public.capture_history_actor_snapshot() returns trigger language plpgsql set search_path='' as $$
begin
  if new.changed_by_employee_id is not null then select coalesce(e.full_name,e.username),e.username into new.changed_by_name,new.changed_by_username from public.employees e where e.id=new.changed_by_employee_id;end if;
  return new;
end $$;
create trigger inventory_history_capture_actor before insert on public.inventory_item_history for each row execute function public.capture_history_actor_snapshot();

alter table public.employees drop constraint if exists assigned_shop_required_for_non_owner;
alter table public.inventory_items alter column shop_id drop not null;
alter table public.sales alter column shop_id drop not null,alter column employee_id drop not null;
alter table public.employee_invitations alter column created_by drop not null;

alter table public.employees drop constraint employees_auth_user_id_fkey,add constraint employees_auth_user_id_fkey foreign key(auth_user_id) references auth.users(id) on delete cascade;
alter table public.employees drop constraint employees_shop_id_fkey,add constraint employees_shop_id_fkey foreign key(shop_id) references public.shops(id) on delete set null;
alter table public.inventory_items drop constraint inventory_items_shop_id_fkey,add constraint inventory_items_shop_id_fkey foreign key(shop_id) references public.shops(id) on delete set null;
alter table public.sales drop constraint sales_shop_id_fkey,add constraint sales_shop_id_fkey foreign key(shop_id) references public.shops(id) on delete set null;
alter table public.sales drop constraint sales_employee_id_fkey,add constraint sales_employee_id_fkey foreign key(employee_id) references public.employees(id) on delete set null;
alter table public.inventory_item_history drop constraint inventory_item_history_changed_by_employee_id_fkey,add constraint inventory_item_history_changed_by_employee_id_fkey foreign key(changed_by_employee_id) references public.employees(id) on delete set null;
alter table public.pricing_rules drop constraint pricing_rules_created_by_fkey,add constraint pricing_rules_created_by_fkey foreign key(created_by) references public.employees(id) on delete set null;
alter table public.pricing_rules drop constraint pricing_rules_shop_id_fkey,add constraint pricing_rules_shop_id_fkey foreign key(shop_id) references public.shops(id) on delete cascade;
alter table public.employee_invitations drop constraint employee_invitations_created_by_fkey,add constraint employee_invitations_created_by_fkey foreign key(created_by) references public.employees(id) on delete set null;
alter table public.employee_invitations drop constraint employee_invitations_shop_id_fkey,add constraint employee_invitations_shop_id_fkey foreign key(shop_id) references public.shops(id) on delete set null;
alter table public.employee_invitations drop constraint employee_invitations_auth_user_id_fkey,add constraint employee_invitations_auth_user_id_fkey foreign key(auth_user_id) references auth.users(id) on delete set null;

create or replace function public.validate_admin_employee(p_role text,p_shop_id uuid,p_active boolean) returns void language plpgsql stable security definer set search_path='' set row_security=off as $$
begin
  if p_role not in ('owner','salesperson') then raise exception using errcode='22023',message='Select a valid employee role.';end if;
  if p_shop_id is not null and not exists(select 1 from public.shops where id=p_shop_id and is_active) then raise exception using errcode='22023',message='Select an active shop.';end if;
end $$;

create or replace function public.protect_last_owner_delete() returns trigger language plpgsql set search_path='' set row_security=off as $$
begin
  if old.role='owner' and old.is_active then
    perform pg_advisory_xact_lock(hashtextextended('public.employees.active_owner',0));
    if not exists(select 1 from public.employees where id<>old.id and role='owner' and is_active) then raise exception using errcode='22023',message='The last active Owner cannot be deleted.';end if;
  end if;
  return old;
end $$;
create trigger employees_protect_last_owner_delete before delete on public.employees for each row execute function public.protect_last_owner_delete();

create or replace function public.admin_prepare_account_deletion(p_employee_id uuid) returns uuid language plpgsql security definer set search_path='' set row_security=off as $$
declare target public.employees%rowtype;
begin
  perform public.require_owner_employee();
  select * into target from public.employees where id=p_employee_id for update;
  if not found then raise exception using errcode='22023',message='Account not found.';end if;
  if target.role='owner' and target.is_active and not exists(select 1 from public.employees where id<>target.id and role='owner' and is_active) then raise exception using errcode='22023',message='The last active Owner cannot be deleted.';end if;
  return target.auth_user_id;
end $$;
revoke all on function public.admin_prepare_account_deletion(uuid) from public,anon;
grant execute on function public.admin_prepare_account_deletion(uuid) to authenticated;

create or replace function public.admin_delete_shop(p_shop_id uuid) returns void language plpgsql security definer set search_path='' set row_security=off as $$
begin
  perform public.require_owner_employee();
  delete from public.shops where id=p_shop_id;
  if not found then raise exception using errcode='22023',message='Shop not found.';end if;
end $$;
revoke all on function public.admin_delete_shop(uuid) from public,anon;
grant execute on function public.admin_delete_shop(uuid) to authenticated;

do $$ declare definition text;begin
  definition:=pg_get_functiondef('public.get_dashboard_report(text,uuid)'::regprocedure);
  if position('join public.shops sh on sh.id=s.shop_id join public.employees emp on emp.id=s.employee_id' in definition)=0 then raise exception 'Expected dashboard identity joins not found';end if;
  definition:=replace(definition,'join public.shops sh on sh.id=s.shop_id join public.employees emp on emp.id=s.employee_id','left join public.shops sh on sh.id=s.shop_id left join public.employees emp on emp.id=s.employee_id');
  definition:=replace(definition,'''shop'',sh.name,''employee'',coalesce(emp.full_name,''Staff member'')','''shop'',coalesce(sh.name,s.shop_name),''employee'',coalesce(emp.full_name,s.employee_name,s.employee_username,''Deleted account'')');
  execute definition;
end $$;

comment on column public.sales.shop_name is 'Immutable shop name captured when the sale is created.';
comment on column public.sales.employee_name is 'Immutable salesperson display name captured when the sale is created.';
comment on function public.admin_delete_shop(uuid) is 'Owner-only permanent shop deletion; current assignments become NULL and sales keep snapshots.';
