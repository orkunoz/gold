-- Revalidate mutable role/shop assignment state at invitation finalization time.
create or replace function public.admin_finalize_employee_invite(p_invitation_id uuid,p_auth_user_id uuid) returns uuid
language plpgsql security definer set search_path='' set row_security=off as $$
declare v_invite public.employee_invitations%rowtype; v_id uuid; v_auth_email text;
begin
  perform public.require_owner_employee();
  select * into v_invite from public.employee_invitations where id=p_invitation_id for update;
  if not found or v_invite.status<>'PENDING' then raise exception using errcode='22023',message='Pending invitation not found.'; end if;
  select lower(btrim(email)) into v_auth_email from auth.users where id=p_auth_user_id;
  if v_auth_email is distinct from v_invite.email then raise exception using errcode='42501',message='Auth identity does not match the invited email.'; end if;
  -- Shop activity may have changed after preparation; validate immediately before insertion.
  perform public.validate_admin_employee(v_invite.role,v_invite.shop_id,true);
  insert into public.employees(auth_user_id,email,full_name,role,shop_id,is_active)
  values(p_auth_user_id,v_invite.email,v_invite.full_name,v_invite.role,v_invite.shop_id,true) returning id into v_id;
  update public.employee_invitations set status='ACCEPTED',auth_user_id=p_auth_user_id,accepted_at=now() where id=p_invitation_id;
  return v_id;
end $$;
revoke all on function public.admin_finalize_employee_invite(uuid,uuid) from public,anon;
grant execute on function public.admin_finalize_employee_invite(uuid,uuid) to authenticated;
