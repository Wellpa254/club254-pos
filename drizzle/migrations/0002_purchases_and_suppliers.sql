create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  phone text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.suppliers to authenticated;
grant all on public.suppliers to service_role;
alter table public.suppliers enable row level security;
create policy "cost roles read suppliers" on public.suppliers for select to authenticated using (public.can_see_costs(auth.uid()));
create policy "cost roles add suppliers" on public.suppliers for insert to authenticated with check (public.can_see_costs(auth.uid()));
create policy "cost roles edit suppliers" on public.suppliers for update to authenticated using (public.can_see_costs(auth.uid())) with check (public.can_see_costs(auth.uid()));

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id),
  invoice_no text,
  purchase_date date not null default (now() at time zone 'Africa/Nairobi')::date,
  total numeric(12,2) not null default 0,
  paid boolean not null default false,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
grant select on public.purchases to authenticated;
grant all on public.purchases to service_role;
alter table public.purchases enable row level security;
create policy "cost roles read purchases" on public.purchases for select to authenticated using (public.can_see_costs(auth.uid()));

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity numeric(12,2) not null,
  unit_cost numeric(12,2) not null,
  subtotal numeric(12,2) not null
);
create index on public.purchase_items(purchase_id);
grant select on public.purchase_items to authenticated;
grant all on public.purchase_items to service_role;
alter table public.purchase_items enable row level security;
create policy "cost roles read purchase items" on public.purchase_items for select to authenticated using (public.can_see_costs(auth.uid()));

create or replace function public.record_purchase(_supplier uuid, _invoice text, _date date, _paid boolean, _items jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid; it jsonb; q numeric; c numeric; tot numeric := 0;
begin
  if not public.can_see_costs(auth.uid()) then raise exception 'Not allowed'; end if;
  if jsonb_array_length(coalesce(_items,'[]'::jsonb)) = 0 then raise exception 'Add at least one item'; end if;
  insert into purchases(supplier_id, invoice_no, purchase_date, paid, created_by)
    values (_supplier, nullif(trim(_invoice),''), coalesce(_date, (now() at time zone 'Africa/Nairobi')::date), coalesce(_paid,false), auth.uid())
    returning id into pid;
  for it in select * from jsonb_array_elements(_items) loop
    q := (it->>'quantity')::numeric; c := (it->>'unit_cost')::numeric;
    perform public.receive_stock((it->>'product_id')::uuid, q, c, coalesce(nullif(trim(_invoice),''), 'Purchase'));
    insert into purchase_items(purchase_id, product_id, quantity, unit_cost, subtotal)
      values (pid, (it->>'product_id')::uuid, q, c, round(q*c,2));
    tot := tot + round(q*c,2);
  end loop;
  update purchases set total = tot where id = pid;
  perform log_audit('purchase_record','purchase',pid::text,null,jsonb_build_object('total',tot,'supplier',_supplier));
  return pid;
end $$;

create or replace function public.set_purchase_paid(_id uuid, _paid boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_see_costs(auth.uid()) then raise exception 'Not allowed'; end if;
  update purchases set paid = _paid where id = _id;
  perform log_audit('purchase_paid','purchase',_id::text,null,jsonb_build_object('paid',_paid));
end $$;