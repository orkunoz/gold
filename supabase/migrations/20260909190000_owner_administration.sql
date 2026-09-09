-- Task 7: audit-safe Owner administration for shops and employees.

update public.shops set code='SHOP-'||upper(substr(id::text,1,8)) where code is null or btrim(code)='';
update public.shops set name=btrim(name),code=upper(btrim(code));
alter table public.shops alter column code set not null;
alter table public.shops add constraint shops_name_length check(length(name)<=200);
alter table public.shops add constraint shops_code_format check(code=upper(btrim(code)) and length(code) between 1 and 40);

alter table public.employees add column email text;
update public.employees e set email=lower(btrim(u.email)) from auth.users u where u.id=e.auth_user_id and u.email is not null;
create unique index employees_email_unique on public.employees(email) where email is not null;
alter table public.employees add constraint employees_email_normalized check(email is null or (email=lower(btrim(email)) and length(email)<=320));

create table public.employee_invitations(
  id uuid primary key default gen_random_uuid(),email text not null unique,full_name text not null,
  role text not null check(role in ('owner','manager','salesperson')),shop_id uuid references public.shops(id) on delete restrict,
  status text not null default 'PENDING' check(status in ('PENDING','ACCEPTED')),created_by uuid not null references public.employees(id) on delete restrict,
  auth_user_id uuid unique references auth.users(id) on delete restrict,created_at timestamptz not null default now(),accepted_at timestamptz,
  constraint employee_invite_email_normalized check(email=lower(btrim(email)) and length(email)<=320),
  constraint employee_invite_name_valid check(btrim(full_name)<>'' and length(full_name)<=200)
);
alter table public.employee_invitations enable row level security;
revoke all on public.employee_invitations from public,anon,authenticated;
grant select on public.employee_invitations to authenticated;
create policy employee_invitations_owner_select on public.employee_invitations for select to authenticated using((select public.is_owner()));

create or replace function public.require_owner_employee() returns public.employees language plpgsql stable security definer set search_path='' set row_security=off as $$
declare v public.employees%rowtype; begin select * into v from public.employees where auth_user_id=(select auth.uid()) and is_active and role='owner'; if not found then raise exception using errcode='42501',message='Active Owner access is required.'; end if; return v; end $$;

create or replace function public.validate_admin_employee(p_role text,p_shop_id uuid,p_active boolean) returns void language plpgsql stable security definer set search_path='' set row_security=off as $$
begin
  if p_role not in ('owner','manager','salesperson') then raise exception using errcode='22023',message='Select a valid employee role.'; end if;
  if p_role in ('manager','salesperson') and p_shop_id is null then raise exception using errcode='22023',message='Managers and salespeople require an active shop.'; end if;
  if (p_role in ('manager','salesperson') or (p_active and p_shop_id is not null)) and not exists(select 1 from public.shops where id=p_shop_id and is_active) then raise exception using errcode='22023',message='Select an active shop.'; end if;
end $$;

create or replace function public.admin_create_shop(p_name text,p_code text) returns uuid language plpgsql security definer set search_path='' set row_security=off as $$
declare v_id uuid; begin perform public.require_owner_employee(); p_name:=btrim(p_name); p_code:=upper(btrim(p_code)); if p_name='' or length(p_name)>200 or p_code='' or length(p_code)>40 then raise exception using errcode='22023',message='Enter a valid shop name and code.'; end if; insert into public.shops(name,code) values(p_name,p_code) returning id into v_id; return v_id; end $$;
create or replace function public.admin_update_shop(p_shop_id uuid,p_name text,p_code text) returns void language plpgsql security definer set search_path='' set row_security=off as $$
begin perform public.require_owner_employee(); p_name:=btrim(p_name); p_code:=upper(btrim(p_code)); if p_name='' or length(p_name)>200 or p_code='' or length(p_code)>40 then raise exception using errcode='22023',message='Enter a valid shop name and code.'; end if; update public.shops set name=p_name,code=p_code where id=p_shop_id; if not found then raise exception using errcode='22023',message='Shop not found.'; end if; end $$;
create or replace function public.admin_set_shop_active(p_shop_id uuid,p_active boolean) returns void language plpgsql security definer set search_path='' set row_security=off as $$
begin perform public.require_owner_employee(); if not p_active then if exists(select 1 from public.employees where shop_id=p_shop_id and is_active) then raise exception using errcode='22023',message='Deactivate or reassign active employees first.'; end if; if exists(select 1 from public.inventory_items where shop_id=p_shop_id and status in ('IN_STOCK','RESERVED')) then raise exception using errcode='22023',message='A shop with in-stock or reserved inventory cannot be deactivated.'; end if; end if; update public.shops set is_active=p_active where id=p_shop_id; if not found then raise exception using errcode='22023',message='Shop not found.'; end if; end $$;

create or replace function public.admin_update_employee(p_employee_id uuid,p_full_name text,p_role text,p_shop_id uuid,p_active boolean) returns void language plpgsql security definer set search_path='' set row_security=off as $$
declare v_old public.employees%rowtype; begin perform public.require_owner_employee(); select * into v_old from public.employees where id=p_employee_id for update; if not found then raise exception using errcode='22023',message='Employee not found.'; end if; perform public.validate_admin_employee(p_role,p_shop_id,p_active); if v_old.role='owner' and v_old.is_active and (p_role<>'owner' or not p_active) and not exists(select 1 from public.employees where id<>p_employee_id and role='owner' and is_active) then raise exception using errcode='22023',message='The last active Owner cannot be deactivated or changed to another role.'; end if; p_full_name:=nullif(btrim(p_full_name),''); if p_full_name is not null and length(p_full_name)>200 then raise exception using errcode='22023',message='Full name is too long.'; end if; update public.employees set full_name=p_full_name,role=p_role,shop_id=p_shop_id,is_active=p_active where id=p_employee_id; end $$;

create or replace function public.admin_prepare_employee_invite(p_email text,p_full_name text,p_role text,p_shop_id uuid) returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare v_owner public.employees%rowtype; v_invitation_id uuid; begin v_owner:=public.require_owner_employee(); p_email:=lower(btrim(p_email)); p_full_name:=btrim(p_full_name); if p_email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p_email)>320 then raise exception using errcode='22023',message='Enter a valid email address.'; end if; if p_full_name='' or length(p_full_name)>200 then raise exception using errcode='22023',message='Enter a valid full name.'; end if; perform public.validate_admin_employee(p_role,p_shop_id,true); if exists(select 1 from public.employees where public.employees.email=p_email) then raise exception using errcode='23505',message='An employee with this email already exists.'; end if; insert into public.employee_invitations(email,full_name,role,shop_id,created_by) values(p_email,p_full_name,p_role,p_shop_id,v_owner.id) on conflict(email) do update set full_name=excluded.full_name,role=excluded.role,shop_id=excluded.shop_id where employee_invitations.status='PENDING' returning id into v_invitation_id; if v_invitation_id is null then raise exception using errcode='23505',message='This invitation has already been accepted.'; end if; return jsonb_build_object('invitation_id',v_invitation_id,'email',p_email); end $$;
create or replace function public.admin_finalize_employee_invite(p_invitation_id uuid,p_auth_user_id uuid) returns uuid language plpgsql security definer set search_path='' set row_security=off as $$
declare v_invite public.employee_invitations%rowtype; v_id uuid; v_auth_email text; begin perform public.require_owner_employee(); select * into v_invite from public.employee_invitations where id=p_invitation_id for update; if not found or v_invite.status<>'PENDING' then raise exception using errcode='22023',message='Pending invitation not found.'; end if; select lower(btrim(email)) into v_auth_email from auth.users where id=p_auth_user_id; if v_auth_email is distinct from v_invite.email then raise exception using errcode='42501',message='Auth identity does not match the invited email.'; end if; insert into public.employees(auth_user_id,email,full_name,role,shop_id,is_active) values(p_auth_user_id,v_invite.email,v_invite.full_name,v_invite.role,v_invite.shop_id,true) returning id into v_id; update public.employee_invitations set status='ACCEPTED',auth_user_id=p_auth_user_id,accepted_at=now() where id=p_invitation_id; return v_id; end $$;

revoke insert,update,delete on public.shops,public.employees from authenticated;
drop policy if exists shops_insert_owner on public.shops; drop policy if exists shops_update_owner on public.shops; drop policy if exists shops_delete_owner on public.shops;
drop policy if exists employees_insert_owner on public.employees; drop policy if exists employees_update_owner on public.employees; drop policy if exists employees_delete_owner on public.employees;
revoke all on function public.require_owner_employee(),public.validate_admin_employee(text,uuid,boolean),public.admin_create_shop(text,text),public.admin_update_shop(uuid,text,text),public.admin_set_shop_active(uuid,boolean),public.admin_update_employee(uuid,text,text,uuid,boolean),public.admin_prepare_employee_invite(text,text,text,uuid),public.admin_finalize_employee_invite(uuid,uuid) from public,anon;
grant execute on function public.admin_create_shop(text,text),public.admin_update_shop(uuid,text,text),public.admin_set_shop_active(uuid,boolean),public.admin_update_employee(uuid,text,text,uuid,boolean),public.admin_prepare_employee_invite(text,text,text,uuid),public.admin_finalize_employee_invite(uuid,uuid) to authenticated;
