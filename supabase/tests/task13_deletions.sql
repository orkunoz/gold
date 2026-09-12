-- Rollback-only Task 13 account/shop deletion verification.
begin;
do $$
declare owner public.employees%rowtype;shop_id uuid:=gen_random_uuid();other_shop uuid:=gen_random_uuid();auth_id uuid:=gen_random_uuid();employee_id uuid:=gen_random_uuid();unassigned_auth uuid:=gen_random_uuid();unassigned_employee uuid:=gen_random_uuid();item_id uuid:=gen_random_uuid();sale_id uuid:=gen_random_uuid();prepared uuid;
begin
 select * into owner from public.employees where role='owner' and is_active order by created_at limit 1;if not found then raise exception 'Active Owner required';end if;
 insert into public.shops(id,name,code)values(shop_id,'Task 13 Disposable','TASK13-DELETE'),(other_shop,'Task 13 Other','TASK13-OTHER');
 insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values(auth_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','task13_delete@internal.local','',now(),'{}','{}',now(),now());
 insert into public.employees(id,auth_user_id,email,username,full_name,role,shop_id,is_active)values(employee_id,auth_id,'task13_delete@internal.local','task13_delete','Task 13 Seller','salesperson',shop_id,true);
 insert into public.inventory_items(id,shop_id,barcode,status)values(item_id,shop_id,'TASK13-ITEM','SOLD');
 insert into public.sales(id,shop_id,employee_id,sale_number,total_sale_price)values(sale_id,shop_id,employee_id,'TASK13-SALE',100);
 insert into public.sale_items(sale_id,inventory_item_id,sale_price)values(sale_id,item_id,100);
 perform set_config('request.jwt.claim.sub',owner.auth_user_id::text,true);prepared:=public.admin_prepare_account_deletion(employee_id);if prepared<>auth_id then raise exception 'Account deletion authorization failed';end if;
 delete from auth.users where id=auth_id;
 if exists(select 1 from public.employees where id=employee_id) or not exists(select 1 from public.sales where id=sale_id and employee_id is null and employee_name='Task 13 Seller') then raise exception 'Account history preservation failed';end if;
 insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values(unassigned_auth,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','task13_unassigned@internal.local','',now(),'{}','{}',now(),now());
 insert into public.employees(id,auth_user_id,email,username,full_name,role,shop_id,is_active)values(unassigned_employee,unassigned_auth,'task13_unassigned@internal.local','task13_unassigned','Task 13 Unassigned','salesperson',shop_id,true);
 perform public.admin_delete_shop(shop_id);
 if exists(select 1 from public.shops where id=shop_id) or not exists(select 1 from public.inventory_items where id=item_id and shop_id is null) or not exists(select 1 from public.employees where id=unassigned_employee and shop_id is null) or not exists(select 1 from public.sales where id=sale_id and shop_id is null and shop_name='Task 13 Disposable') then raise exception 'Shop deletion/unassignment failed';end if;
 perform set_config('request.jwt.claim.sub',unassigned_auth::text,true);begin perform public.complete_sale(other_shop,format('[{"inventory_item_id":"%s","discount_percent":0}]',item_id)::jsonb,null);raise exception 'Unassigned Salesperson checkout succeeded';exception when insufficient_privilege then null;end;
 begin delete from public.employees where id=owner.id;raise exception 'Sole Owner deletion succeeded';exception when data_exception then null;end;
 perform set_config('request.jwt.claim.sub',unassigned_auth::text,true);begin perform public.admin_delete_shop(other_shop);raise exception 'Salesperson shop deletion succeeded';exception when insufficient_privilege then null;end;begin perform public.admin_prepare_account_deletion(unassigned_employee);raise exception 'Salesperson account deletion succeeded';exception when insufficient_privilege then null;end;
end $$;
rollback;
