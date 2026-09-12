-- Rollback-only current Owner account administration verification.
begin;
do $$
declare owner_employee public.employees%rowtype;v_shop_id uuid;account_auth uuid:=gen_random_uuid();account_id uuid;
begin
 select * into owner_employee from public.employees where role='owner' and is_active order by created_at limit 1;
 if not found then raise exception 'Administration verification requires an active Owner';end if;
 perform set_config('request.jwt.claim.sub',owner_employee.auth_user_id::text,true);
 v_shop_id:=public.admin_create_shop('Current Account Test Shop','CURRENT-ACCOUNT-TEST');
 insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 values(account_auth,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','current_test@internal.local','',now(),'{}','{}',now(),now());
 account_id:=public.admin_link_employee_account(account_auth,'current_test','current_test','salesperson',v_shop_id);
 if not exists(select 1 from public.employees where id=account_id and username='current_test' and role='salesperson' and shop_id=v_shop_id and is_active) then raise exception 'Username account linking failed';end if;
 if public.admin_link_employee_account(account_auth,'current_test','current_test','salesperson',v_shop_id)<>account_id then raise exception 'Exact account retry was not idempotent';end if;
 begin perform public.admin_link_employee_account(account_auth,'changed_name','changed_name','salesperson',v_shop_id);raise exception 'Conflicting account retry succeeded';exception when unique_violation then null;end;
 begin perform public.admin_link_employee_account(gen_random_uuid(),'owner2','owner2','owner',null);raise exception 'Routine second Owner creation succeeded';exception when data_exception then null;end;
 begin perform public.admin_update_employee(owner_employee.id,coalesce(owner_employee.full_name,'Owner'),'salesperson',v_shop_id,true);raise exception 'Last active Owner downgrade succeeded';exception when data_exception then null;end;
 begin perform public.admin_set_shop_active(v_shop_id,false);raise exception 'Shop with active account was deactivated';exception when data_exception then null;end;
 if has_table_privilege('authenticated','public.employees','UPDATE') or has_function_privilege('anon','public.admin_link_employee_account(uuid,text,text,text,uuid)','EXECUTE') then raise exception 'Account administration privileges are unsafe';end if;
end $$;
rollback;
