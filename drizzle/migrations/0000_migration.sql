
-- ROLES
create type public.app_role as enum ('owner','manager','cashier','stock_manager');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles ur join public.profiles p on p.id = ur.user_id
    where ur.user_id = _user_id and ur.role = _role and p.active)
$$;

create or replace function public.is_staff_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_user_id,'owner') or public.has_role(_user_id,'manager')
$$;

create or replace function public.can_see_costs(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_user_id,'owner') or public.has_role(_user_id,'manager') or public.has_role(_user_id,'stock_manager')
$$;

create or replace function public.club_has_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where role = 'owner')
$$;
grant execute on function public.club_has_owner() to anon, authenticated;

create policy "own profile or admin read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff_admin(auth.uid()));
create policy "own profile update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "own roles or admin read" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_staff_admin(auth.uid()));

-- signup trigger: first user becomes owner
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), new.email);
  if not exists (select 1 from public.user_roles where role = 'owner') then
    insert into public.user_roles (user_id, role) values (new.id, 'owner');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- CATALOG
create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0
);
grant select, insert, update, delete on public.product_categories to authenticated;
grant all on public.product_categories to service_role;
alter table public.product_categories enable row level security;
create policy "staff read categories" on public.product_categories for select to authenticated using (true);
create policy "cost roles manage categories" on public.product_categories for all to authenticated
  using (public.can_see_costs(auth.uid())) with check (public.can_see_costs(auth.uid()));

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text not null unique,
  barcode text unique,
  category_id uuid references public.product_categories(id),
  brand text,
  image_url text,
  selling_price numeric(12,2) not null check (selling_price >= 0),
  stock_qty numeric(12,2) not null default 0,
  low_stock_threshold numeric(12,2) not null default 10,
  unit text not null default 'bottle',
  active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.products(category_id);
grant select, insert, update on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "staff read products" on public.products for select to authenticated using (true);
create policy "cost roles insert products" on public.products for insert to authenticated with check (public.can_see_costs(auth.uid()));
create policy "cost roles update products" on public.products for update to authenticated using (public.can_see_costs(auth.uid())) with check (public.can_see_costs(auth.uid()));

-- costs isolated from cashiers
create table public.product_costs (
  product_id uuid primary key references public.products(id) on delete cascade,
  avg_cost numeric(12,2) not null default 0,
  last_cost numeric(12,2) not null default 0,
  updated_at timestamptz not null default now()
);
grant select on public.product_costs to authenticated;
grant all on public.product_costs to service_role;
alter table public.product_costs enable row level security;
create policy "cost roles read costs" on public.product_costs for select to authenticated using (public.can_see_costs(auth.uid()));

-- SHIFTS
create table public.cashier_shifts (
  id uuid primary key default gen_random_uuid(),
  cashier_id uuid not null,
  opened_at timestamptz not null default now(),
  opening_cash numeric(12,2) not null check (opening_cash >= 0),
  closed_at timestamptz,
  cash_sales numeric(12,2),
  expected_cash numeric(12,2),
  declared_cash numeric(12,2),
  difference numeric(12,2),
  discrepancy_reason text,
  status text not null default 'open' check (status in ('open','closed'))
);
create unique index one_open_shift_per_cashier on public.cashier_shifts(cashier_id) where status = 'open';
grant select on public.cashier_shifts to authenticated;
grant all on public.cashier_shifts to service_role;
alter table public.cashier_shifts enable row level security;
create policy "own or admin shifts" on public.cashier_shifts for select to authenticated
  using (cashier_id = auth.uid() or public.is_staff_admin(auth.uid()));

-- SALES
create sequence public.receipt_seq start 1;
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  receipt_no text not null unique,
  client_ref uuid not null unique,
  cashier_id uuid not null,
  shift_id uuid references public.cashier_shifts(id),
  subtotal numeric(12,2) not null,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null,
  payment_method text not null check (payment_method in ('cash','mpesa','card','other')),
  status text not null default 'completed',
  created_at timestamptz not null default now()
);
create index on public.sales(created_at);
create index on public.sales(cashier_id);
grant select on public.sales to authenticated;
grant all on public.sales to service_role;
alter table public.sales enable row level security;
create policy "own or admin sales" on public.sales for select to authenticated
  using (cashier_id = auth.uid() or public.is_staff_admin(auth.uid()));

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id),
  product_id uuid not null references public.products(id),
  product_name text not null,
  quantity numeric(12,2) not null check (quantity > 0),
  unit_price numeric(12,2) not null,
  subtotal numeric(12,2) not null
);
create index on public.sale_items(sale_id);
grant select on public.sale_items to authenticated;
grant all on public.sale_items to service_role;
alter table public.sale_items enable row level security;
create policy "items of visible sales" on public.sale_items for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_id and (s.cashier_id = auth.uid() or public.is_staff_admin(auth.uid()))));

create table public.sale_item_costs (
  sale_item_id uuid primary key references public.sale_items(id),
  unit_cost numeric(12,2) not null,
  total_cost numeric(12,2) not null
);
grant select on public.sale_item_costs to authenticated;
grant all on public.sale_item_costs to service_role;
alter table public.sale_item_costs enable row level security;
create policy "owner manager read cogs" on public.sale_item_costs for select to authenticated using (public.is_staff_admin(auth.uid()));

-- INVENTORY MOVEMENTS
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  movement_type text not null check (movement_type in ('opening','purchase','sale','adjustment','loss','return')),
  quantity numeric(12,2) not null,
  unit_cost numeric(12,2),
  reference text,
  note text,
  user_id uuid,
  created_at timestamptz not null default now()
);
create index on public.inventory_movements(product_id, created_at);
grant select on public.inventory_movements to authenticated;
grant all on public.inventory_movements to service_role;
alter table public.inventory_movements enable row level security;
create policy "cost roles read movements" on public.inventory_movements for select to authenticated using (public.can_see_costs(auth.uid()));

-- AUDIT
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text not null,
  object_type text,
  object_id text,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "owner reads audit" on public.audit_logs for select to authenticated using (public.has_role(auth.uid(),'owner'));

create or replace function public.log_audit(_action text, _type text, _id text, _prev jsonb, _new jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs(user_id, action, object_type, object_id, previous_value, new_value)
  values (auth.uid(), _action, _type, _id, _prev, _new)
$$;
revoke execute on function public.log_audit(text,text,text,jsonb,jsonb) from public, anon, authenticated;

-- product price change audit
create or replace function public.audit_product_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if new.selling_price is distinct from old.selling_price then
    perform public.log_audit('price_change','product',new.id::text, jsonb_build_object('selling_price',old.selling_price), jsonb_build_object('selling_price',new.selling_price));
  end if;
  if new.stock_qty is distinct from old.stock_qty and current_setting('clubos.stock_ok', true) is distinct from '1' then
    raise exception 'Stock can only change through sales, purchases or adjustments';
  end if;
  return new;
end $$;
create trigger products_audit before update on public.products for each row execute function public.audit_product_change();

-- RPCs
create or replace function public.open_shift(_opening_cash numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if not (public.has_role(auth.uid(),'cashier') or public.is_staff_admin(auth.uid())) then raise exception 'Not allowed'; end if;
  if _opening_cash < 0 then raise exception 'Opening cash cannot be negative'; end if;
  if exists (select 1 from cashier_shifts where cashier_id = auth.uid() and status='open') then raise exception 'You already have an open shift'; end if;
  insert into cashier_shifts(cashier_id, opening_cash) values (auth.uid(), _opening_cash) returning id into sid;
  perform log_audit('shift_open','shift',sid::text,null,jsonb_build_object('opening_cash',_opening_cash));
  return sid;
end $$;

create or replace function public.close_shift(_declared numeric, _reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s cashier_shifts; cs numeric; exp numeric; diff numeric;
begin
  select * into s from cashier_shifts where cashier_id = auth.uid() and status='open' for update;
  if s.id is null then raise exception 'No open shift'; end if;
  select coalesce(sum(total),0) into cs from sales where shift_id = s.id and payment_method='cash' and status='completed';
  exp := s.opening_cash + cs; diff := _declared - exp;
  if diff <> 0 and coalesce(trim(_reason),'') = '' then raise exception 'A reason is required when cash does not match'; end if;
  update cashier_shifts set closed_at = now(), cash_sales = cs, expected_cash = exp, declared_cash = _declared,
    difference = diff, discrepancy_reason = nullif(trim(_reason),''), status='closed' where id = s.id;
  perform log_audit('shift_close','shift',s.id::text,null,jsonb_build_object('expected',exp,'declared',_declared,'difference',diff));
  return jsonb_build_object('opening_cash',s.opening_cash,'cash_sales',cs,'expected_cash',exp,'declared_cash',_declared,'difference',diff);
end $$;

create or replace function public.complete_sale(_client_ref uuid, _items jsonb, _discount numeric, _payment text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s_id uuid; sh uuid; it jsonb; p products; c numeric; sub numeric := 0; q numeric; rno text; si uuid; existing sales;
begin
  select * into existing from sales where client_ref = _client_ref;
  if existing.id is not null then
    return jsonb_build_object('id',existing.id,'receipt_no',existing.receipt_no,'total',existing.total,'created_at',existing.created_at);
  end if;
  if not (public.has_role(auth.uid(),'cashier') or public.is_staff_admin(auth.uid())) then raise exception 'Not allowed'; end if;
  select id into sh from cashier_shifts where cashier_id = auth.uid() and status='open';
  if sh is null then raise exception 'Start a shift before selling'; end if;
  if jsonb_array_length(_items) = 0 then raise exception 'Cart is empty'; end if;
  perform set_config('clubos.stock_ok','1',true);
  rno := 'CLB-' || lpad(nextval('receipt_seq')::text, 6, '0');
  insert into sales(receipt_no, client_ref, cashier_id, shift_id, subtotal, discount, total, payment_method)
    values (rno, _client_ref, auth.uid(), sh, 0, 0, 0, _payment) returning id into s_id;
  for it in select * from jsonb_array_elements(_items) loop
    q := (it->>'quantity')::numeric;
    if q is null or q <= 0 then raise exception 'Invalid quantity'; end if;
    select * into p from products where id = (it->>'product_id')::uuid and active for update;
    if p.id is null then raise exception 'Product unavailable'; end if;
    if p.stock_qty < q then raise exception 'STOCK_CHANGED:%', p.name; end if;
    select coalesce(avg_cost,0) into c from product_costs where product_id = p.id;
    c := coalesce(c,0);
    insert into sale_items(sale_id, product_id, product_name, quantity, unit_price, subtotal)
      values (s_id, p.id, p.name, q, p.selling_price, q*p.selling_price) returning id into si;
    insert into sale_item_costs values (si, c, c*q);
    update products set stock_qty = stock_qty - q where id = p.id;
    insert into inventory_movements(product_id, movement_type, quantity, unit_cost, reference, user_id)
      values (p.id,'sale',-q,c,rno,auth.uid());
    sub := sub + q*p.selling_price;
  end loop;
  if _discount < 0 or _discount > sub then raise exception 'Invalid discount'; end if;
  update sales set subtotal = sub, discount = _discount, total = sub - _discount where id = s_id;
  return jsonb_build_object('id',s_id,'receipt_no',rno,'total',sub-_discount,'created_at',now());
end $$;

create or replace function public.receive_stock(_product uuid, _qty numeric, _unit_cost numeric, _reference text)
returns void language plpgsql security definer set search_path = public as $$
declare p products; oldc numeric;
begin
  if not public.can_see_costs(auth.uid()) then raise exception 'Not allowed'; end if;
  if _qty <= 0 or _unit_cost < 0 then raise exception 'Invalid quantity or cost'; end if;
  perform set_config('clubos.stock_ok','1',true);
  select * into p from products where id = _product for update;
  select avg_cost into oldc from product_costs where product_id = _product;
  insert into product_costs(product_id, avg_cost, last_cost) values (_product, _unit_cost, _unit_cost)
  on conflict (product_id) do update set
    avg_cost = case when greatest(p.stock_qty,0) + _qty = 0 then _unit_cost
      else round(((greatest(p.stock_qty,0) * coalesce(oldc,0)) + _qty*_unit_cost) / (greatest(p.stock_qty,0) + _qty), 2) end,
    last_cost = _unit_cost, updated_at = now();
  update products set stock_qty = stock_qty + _qty where id = _product;
  insert into inventory_movements(product_id, movement_type, quantity, unit_cost, reference, user_id)
    values (_product,'purchase',_qty,_unit_cost,_reference,auth.uid());
  perform log_audit('stock_receive','product',_product::text,null,jsonb_build_object('qty',_qty,'unit_cost',_unit_cost));
end $$;

create or replace function public.adjust_stock(_product uuid, _qty_change numeric, _type text, _note text)
returns void language plpgsql security definer set search_path = public as $$
declare p products; c numeric;
begin
  if not public.can_see_costs(auth.uid()) then raise exception 'Not allowed'; end if;
  if _type not in ('adjustment','loss','return') then raise exception 'Invalid type'; end if;
  if coalesce(trim(_note),'') = '' then raise exception 'A note is required'; end if;
  perform set_config('clubos.stock_ok','1',true);
  select * into p from products where id = _product for update;
  if p.stock_qty + _qty_change < 0 then raise exception 'Stock cannot go below zero'; end if;
  select avg_cost into c from product_costs where product_id = _product;
  update products set stock_qty = stock_qty + _qty_change where id = _product;
  insert into inventory_movements(product_id, movement_type, quantity, unit_cost, note, user_id)
    values (_product,_type,_qty_change,c,_note,auth.uid());
  perform log_audit('stock_adjust','product',_product::text,jsonb_build_object('qty',p.stock_qty),jsonb_build_object('qty',p.stock_qty+_qty_change,'note',_note));
end $$;

revoke execute on function public.open_shift(numeric), public.close_shift(numeric,text), public.complete_sale(uuid,jsonb,numeric,text), public.receive_stock(uuid,numeric,numeric,text), public.adjust_stock(uuid,numeric,text,text) from public, anon;
grant execute on function public.open_shift(numeric), public.close_shift(numeric,text), public.complete_sale(uuid,jsonb,numeric,text), public.receive_stock(uuid,numeric,numeric,text), public.adjust_stock(uuid,numeric,text,text) to authenticated;

-- DEMO DATA
insert into public.product_categories(name, sort_order) values
 ('Beer',1),('Spirits',2),('Wine',3),('Soft Drinks',4),('Energy Drinks',5),('Water',6),('Cocktails',7);

do $$
declare r record; pid uuid;
begin
  perform set_config('clubos.stock_ok','1',true);
  for r in select * from (values
    ('Tusker Lager 500ml','BEER-TUS','Beer','EABL',300,210,96,24),
    ('Guinness 500ml','BEER-GUI','Beer','EABL',350,250,72,24),
    ('White Cap 500ml','BEER-WCP','Beer','EABL',300,215,8,24),
    ('Smirnoff Vodka 750ml','SPR-SMI','Spirits','Diageo',2200,1450,14,4),
    ('Johnnie Walker Black 750ml','SPR-JWB','Spirits','Diageo',5500,3350,2,3),
    ('Jameson 750ml','SPR-JAM','Spirits','Pernod Ricard',4200,2800,9,3),
    ('Four Cousins Red 750ml','WIN-4CR','Wine','Van Loveren',1800,1100,12,4),
    ('Coca-Cola 500ml','SFT-COK','Soft Drinks','Coca-Cola',120,60,60,24),
    ('Sprite 500ml','SFT-SPR','Soft Drinks','Coca-Cola',120,60,5,24),
    ('Red Bull 250ml','ENR-RDB','Energy Drinks','Red Bull',350,210,40,12),
    ('Dasani Water 500ml','WAT-DAS','Water','Coca-Cola',100,45,80,24),
    ('Mojito','CKT-MOJ','Cocktails','House',800,260,0,0)
  ) as t(name,sku,cat,brand,price,cost,qty,thr) loop
    insert into products(name,sku,category_id,brand,selling_price,stock_qty,low_stock_threshold,unit,is_demo)
      values (r.name, r.sku, (select id from product_categories where name=r.cat), r.brand, r.price,
        case when r.cat='Cocktails' then 999 else r.qty end, r.thr,
        case when r.cat='Cocktails' then 'serving' else 'bottle' end, true)
      returning id into pid;
    insert into product_costs(product_id, avg_cost, last_cost) values (pid, r.cost, r.cost);
    insert into inventory_movements(product_id, movement_type, quantity, unit_cost, reference, note)
      values (pid,'opening', case when r.cat='Cocktails' then 999 else r.qty end, r.cost,'DEMO-OPEN','Demo opening stock');
  end loop;
end $$;
