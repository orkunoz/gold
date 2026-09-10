-- Keep shop/category history human-readable and harden trigger-only helpers.
create or replace function public.record_inventory_history() returns trigger language plpgsql security definer set search_path='' set row_security=off as $$
declare v_employee uuid; v_source text; v_sale uuid; v_field text; v_old text; v_new text;
begin
 select id into v_employee from public.employees where auth_user_id=(select auth.uid()) and is_active limit 1;
 v_source:=coalesce(nullif(current_setting('gold.audit_source',true),''),case when tg_op='INSERT' then 'SYSTEM' else 'MANUAL_EDIT' end);
 begin v_sale:=nullif(current_setting('gold.audit_sale_id',true),'')::uuid; exception when invalid_text_representation then v_sale:=null; end;
 if tg_op='INSERT' then insert into public.inventory_item_history(inventory_item_id,field_name,new_value,changed_by_employee_id,source,sale_id) values(new.id,'CREATED','Inventory item created',v_employee,v_source,v_sale); return new; end if;
 for v_field,v_old,v_new in select * from (values
  ('Product Category',old.category_id::text,new.category_id::text),('Metal',old.metal,new.metal),('Producer',old.producer,new.producer),('Size',old.size,new.size),('Article',old.article_number,new.article_number),('Weight',old.weight_grams::text,new.weight_grams::text),('Price per Gram',old.price_per_gram::text,new.price_per_gram::text),('Inventory Price',old.price::text,new.price::text),('Inventory Discount',old.discount,new.discount),('Status',old.status,new.status),('Shop',old.shop_id::text,new.shop_id::text),('Barcode',old.barcode,new.barcode),('Notes',old.notes,new.notes),('Owner/base price',old.owner_price::text,new.owner_price::text),('Manual selling price',old.selling_price::text,new.selling_price::text)
 ) changes(field_name,old_value,new_value) where old_value is distinct from new_value loop
  if v_field='Shop' then select name into v_old from public.shops where id=old.shop_id; select name into v_new from public.shops where id=new.shop_id;
  elsif v_field='Product Category' then select name into v_old from public.product_categories where id=old.category_id; select name into v_new from public.product_categories where id=new.category_id; end if;
  insert into public.inventory_item_history(inventory_item_id,field_name,old_value,new_value,changed_by_employee_id,source,sale_id) values(new.id,v_field,v_old,v_new,v_employee,case when v_source='MANUAL_EDIT' and v_field='Status' then 'STATUS_CHANGE' when v_source='MANUAL_EDIT' and v_field='Shop' then 'SHOP_TRANSFER' else v_source end,v_sale);
 end loop; return new;
end $$;
revoke all on function public.record_inventory_history() from public,anon,authenticated;
revoke all on function public.set_inventory_calculated_price() from public,anon,authenticated;
