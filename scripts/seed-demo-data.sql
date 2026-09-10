-- Idempotent, production-safe Task 9 demo seed. Run only with a migration-capable connection.
-- Targets exact DEMO identifiers; never uses broad cleanup criteria.
begin;

insert into public.shops(name,code,is_active) values('Shop2','SHOP2',true)
on conflict(code) do update set name=excluded.name,is_active=true;
insert into public.shops(name,code,is_active) values('Shop3','SHOP3',true)
on conflict(code) do update set name=excluded.name,is_active=true;

do $$
declare
  v_main_shop uuid; v_shop2 uuid; v_shop3 uuid; v_owner uuid;
  v_name text;
begin
  select id into v_main_shop from public.shops where code not in ('SHOP2','SHOP3') order by created_at limit 1;
  if v_main_shop is null then raise exception 'An existing primary shop is required before demo seeding.'; end if;
  select id into v_shop2 from public.shops where code='SHOP2';
  select id into v_shop3 from public.shops where code='SHOP3';
  select id into v_owner from public.employees where role='owner' and is_active order by created_at limit 1;
  if v_owner is null then raise exception 'An active Owner employee is required for demo attribution.'; end if;

  foreach v_name in array array['Bracelet','Ring','Earrings','Chain','Necklace','Pendant'] loop
    if not exists(select 1 from public.product_categories where lower(name)=lower(v_name)) then
      insert into public.product_categories(name) values(v_name);
    end if;
  end loop;

  if exists(
    select 1 from public.inventory_items
    where barcode ~ '^DEMO-(00[1-9]|01[0-9]|020)$'
      and notes is distinct from 'DEMO DATA — SAFE TO REMOVE'
  ) then raise exception 'A DEMO barcode belongs to non-demo inventory; seed aborted.'; end if;
  if exists(
    select 1 from public.inventory_items
    where article_number ~ '^DEMO-A(00[1-9]|01[0-9]|020)$'
      and not (barcode ~ '^DEMO-(00[1-9]|01[0-9]|020)$' and notes='DEMO DATA — SAFE TO REMOVE')
  ) then raise exception 'A DEMO article number belongs to non-demo inventory; seed aborted.'; end if;
  if exists(
    select 1 from public.sales
    where sale_number ~ '^DEMO-SALE-0(0[1-9]|10)$'
      and notes is distinct from 'DEMO DATA — SAFE TO REMOVE'
  ) then raise exception 'A DEMO sale number belongs to non-demo history; seed aborted.'; end if;

  insert into public.inventory_items(shop_id,barcode,article_number,category_id,gold_fineness,gold_color,weight_grams,size,owner_price,selling_price,status,received_at,notes,created_by)
  select source.shop_id,source.barcode,source.article_number,category.id,'585',source.gold_color,source.weight,source.size,source.owner_price,source.selling_price,'IN_STOCK',now()-interval '30 days','DEMO DATA — SAFE TO REMOVE',v_owner
  from (values
    (v_main_shop,'DEMO-001','DEMO-A001','Bracelet','Yellow',5.40::numeric,null,12000::numeric,13800::numeric),
    (v_main_shop,'DEMO-002','DEMO-A002','Ring','White',2.10,'17',5200,6100),
    (v_main_shop,'DEMO-003','DEMO-A003','Earrings','Rose',3.20,null,7600,8800),
    (v_main_shop,'DEMO-004','DEMO-A004','Necklace','Yellow',7.80,null,18500,21000),
    (v_main_shop,'DEMO-005','DEMO-A005','Chain','White',6.30,null,14900,17200),
    (v_main_shop,'DEMO-006','DEMO-A006','Pendant','Rose',1.40,null,3900,4600),
    (v_main_shop,'DEMO-007','DEMO-A007','Bracelet','Yellow',4.90,null,11100,12800),
    (v_main_shop,'DEMO-008','DEMO-A008','Ring','Yellow',1.80,'18',4700,5500),
    (v_shop2,'DEMO-009','DEMO-A009','Bracelet','White',4.60,null,10800,12500),
    (v_shop2,'DEMO-010','DEMO-A010','Chain','Yellow',5.90,null,13600,15700),
    (v_shop2,'DEMO-011','DEMO-A011','Pendant','Rose',1.10,null,3300,3900),
    (v_shop2,'DEMO-012','DEMO-A012','Earrings','Yellow',2.70,null,6500,7500),
    (v_shop2,'DEMO-013','DEMO-A013','Necklace','White',7.10,null,16900,19400),
    (v_shop2,'DEMO-014','DEMO-A014','Ring','Rose',2.30,'16.5',5600,6500),
    (v_shop3,'DEMO-015','DEMO-A015','Earrings','White',3.60,null,8400,9700),
    (v_shop3,'DEMO-016','DEMO-A016','Necklace','Rose',6.80,null,15800,18200),
    (v_shop3,'DEMO-017','DEMO-A017','Ring','Yellow',2.50,'17.5',6100,7100),
    (v_shop3,'DEMO-018','DEMO-A018','Bracelet','Rose',5.20,null,11600,13400),
    (v_shop3,'DEMO-019','DEMO-A019','Chain','White',4.80,null,11300,13100),
    (v_shop3,'DEMO-020','DEMO-A020','Pendant','Yellow',0.90,null,2900,3400)
  ) source(shop_id,barcode,article_number,category_name,gold_color,weight,size,owner_price,selling_price)
  join lateral (select id from public.product_categories where lower(name)=lower(source.category_name) order by created_at limit 1) category on true
  on conflict(barcode) do nothing;

  insert into public.sales(shop_id,employee_id,sale_number,sold_at,total_list_price,total_sale_price,notes)
  select item.shop_id,v_owner,source.sale_number,now()-source.days_ago*interval '1 day',item.selling_price,source.sale_price,'DEMO DATA — SAFE TO REMOVE'
  from (values
    ('DEMO-SALE-001','DEMO-001',0,13600::numeric),('DEMO-SALE-002','DEMO-002',1,6000),
    ('DEMO-SALE-003','DEMO-003',3,8600),('DEMO-SALE-004','DEMO-004',5,20500),
    ('DEMO-SALE-005','DEMO-009',2,12300),('DEMO-SALE-006','DEMO-010',4,15400),
    ('DEMO-SALE-007','DEMO-011',7,3800),('DEMO-SALE-008','DEMO-015',1,9500),
    ('DEMO-SALE-009','DEMO-016',6,17900),('DEMO-SALE-010','DEMO-017',9,6900)
  ) source(sale_number,barcode,days_ago,sale_price)
  join public.inventory_items item on item.barcode=source.barcode and item.notes='DEMO DATA — SAFE TO REMOVE'
  where not exists(select 1 from public.sales existing where existing.sale_number=source.sale_number);

  insert into public.sale_items(sale_id,inventory_item_id,list_price,sale_price)
  select sale.id,item.id,item.selling_price,source.sale_price
  from (values
    ('DEMO-SALE-001','DEMO-001',13600::numeric),('DEMO-SALE-002','DEMO-002',6000),
    ('DEMO-SALE-003','DEMO-003',8600),('DEMO-SALE-004','DEMO-004',20500),
    ('DEMO-SALE-005','DEMO-009',12300),('DEMO-SALE-006','DEMO-010',15400),
    ('DEMO-SALE-007','DEMO-011',3800),('DEMO-SALE-008','DEMO-015',9500),
    ('DEMO-SALE-009','DEMO-016',17900),('DEMO-SALE-010','DEMO-017',6900)
  ) source(sale_number,barcode,sale_price)
  join public.sales sale on sale.sale_number=source.sale_number and sale.notes='DEMO DATA — SAFE TO REMOVE'
  join public.inventory_items item on item.barcode=source.barcode and item.notes='DEMO DATA — SAFE TO REMOVE'
  on conflict(inventory_item_id) do nothing;

  update public.inventory_items item set status='SOLD'
  where item.notes='DEMO DATA — SAFE TO REMOVE'
    and exists(select 1 from public.sale_items line join public.sales sale on sale.id=line.sale_id where line.inventory_item_id=item.id and sale.sale_number ~ '^DEMO-SALE-0(0[1-9]|10)$' and sale.notes='DEMO DATA — SAFE TO REMOVE');

  if (select count(*) from public.inventory_items where barcode ~ '^DEMO-(00[1-9]|01[0-9]|020)$' and notes='DEMO DATA — SAFE TO REMOVE')<>20 then raise exception 'Demo inventory count is not 20.'; end if;
  if (select count(*) from public.inventory_items where barcode ~ '^DEMO-(00[1-9]|01[0-9]|020)$' and notes='DEMO DATA — SAFE TO REMOVE' and status='SOLD')<>10 then raise exception 'Demo SOLD count is not 10.'; end if;
  if (select count(*) from public.inventory_items where barcode ~ '^DEMO-(00[1-9]|01[0-9]|020)$' and notes='DEMO DATA — SAFE TO REMOVE' and status='IN_STOCK')<>10 then raise exception 'Demo IN_STOCK count is not 10.'; end if;
  if (select count(*) from public.sales where sale_number ~ '^DEMO-SALE-0(0[1-9]|10)$' and notes='DEMO DATA — SAFE TO REMOVE')<>10 then raise exception 'Demo sales count is not 10.'; end if;
  if exists(select 1 from public.sales sale where sale.sale_number ~ '^DEMO-SALE-0(0[1-9]|10)$' and sale.notes='DEMO DATA — SAFE TO REMOVE' and (select count(*) from public.sale_items where sale_id=sale.id)<>1) then raise exception 'Every demo sale must contain exactly one demo item.'; end if;
  if exists(select 1 from public.sales sale where sale.sale_number ~ '^DEMO-SALE-0(0[1-9]|10)$' and sale.notes='DEMO DATA — SAFE TO REMOVE' and (sale.total_sale_price<>(select sum(sale_price) from public.sale_items where sale_id=sale.id) or sale.total_list_price is distinct from (select sum(list_price) from public.sale_items where sale_id=sale.id))) then raise exception 'Demo sale totals do not match line snapshots.'; end if;
end $$;

commit;
