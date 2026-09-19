-- Rollback-only verification. Requires an active Owner and active location.
begin;
do $$
declare owner public.employees%rowtype; location_id uuid; result jsonb; v_document_id uuid; item_id uuid; original_category text; original_location text; inventory_before bigint; documents_before bigint;
begin
 select * into owner from public.employees where role='owner' and is_active order by created_at limit 1;
 if not found then raise exception 'Added Products verification requires an active Owner'; end if;
 select id into location_id from public.shops where is_active order by created_at limit 1;
 if location_id is null then raise exception 'Added Products verification requires an active location'; end if;
 perform set_config('request.jwt.claim.sub',owner.auth_user_id::text,true);
 result:=public.create_inventory_items_batch(jsonb_build_array(jsonb_build_object('shop_id',location_id,'category_name','Receipt Test Category','article_number','RECEIPT-1','producer','Receipt Producer','size','17','weight_grams','2','purchase_price','100','price_per_gram','200','barcode','RECEIPT-'||gen_random_uuid())));
 v_document_id:=(result->>'document_id')::uuid;
 if coalesce((result->>'count')::int,0)<>1 or v_document_id is null then raise exception 'Batch did not return count and document ID'; end if;
 if (select count(*) from public.added_product_documents where id=v_document_id)<>1 then raise exception 'Expected one receipt header'; end if;
 if (select count(*) from public.added_product_document_items where document_id=v_document_id)<>1 then raise exception 'Expected one receipt line'; end if;
 select inventory_item_id,category_name,location_name into item_id,original_category,original_location from public.added_product_document_items where document_id=v_document_id;
 update public.inventory_items set producer='Changed',size='99',weight_grams=3,price_per_gram=300,purchase_price=999,shop_id=null,barcode=null where id=item_id;
 if exists(select 1 from public.added_product_document_items where document_id=v_document_id and (category_name<>original_category or location_name<>original_location or producer<>'Receipt Producer' or size<>'17' or weight_grams<>2 or price_per_gram<>200 or purchase_price<>100)) then raise exception 'Receipt snapshot changed with inventory'; end if;
 select count(*) into inventory_before from public.inventory_items; select count(*) into documents_before from public.added_product_documents;
 begin
  perform public.create_inventory_items_batch(jsonb_build_array(jsonb_build_object('shop_id',location_id,'category_name','','producer','','weight_grams','0','price_per_gram','0')));
  raise exception 'Invalid batch unexpectedly succeeded';
 exception when sqlstate '22023' then null; end;
 if (select count(*) from public.inventory_items)<>inventory_before or (select count(*) from public.added_product_documents)<>documents_before then raise exception 'Failed batch left products or documents'; end if;
end $$;
rollback;
