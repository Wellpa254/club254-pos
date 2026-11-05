-- Record the cash a customer handed over, so the receipt, reports and audits can show it.
-- Optional: older sales and non-cash sales keep it empty. Change due = cash_received - total.
alter table public.sales add column if not exists cash_received numeric(12,2);
alter table public.sales drop constraint if exists sales_cash_received_check;
alter table public.sales add constraint sales_cash_received_check
  check (cash_received is null or (payment_method = 'cash' and cash_received >= total));

-- complete_sale gains an optional fifth argument. The old four-argument version is dropped first,
-- otherwise both would exist and PostgREST could not tell which one a call means.
drop function if exists public.complete_sale(uuid, jsonb, numeric, text);
create or replace function public.complete_sale(_client_ref uuid, _items jsonb, _discount numeric, _payment text, _cash_received numeric default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s_id uuid; sh uuid; it jsonb; p products; c numeric; sub numeric := 0; q numeric; rno text; si uuid; existing sales;
begin
  select * into existing from sales where client_ref = _client_ref;
  if existing.id is not null then
    return jsonb_build_object('id',existing.id,'receipt_no',existing.receipt_no,'total',existing.total,'created_at',existing.created_at,'cash_received',existing.cash_received);
  end if;
  if not (public.has_role(auth.uid(),'cashier') or public.is_staff_admin(auth.uid())) then raise exception 'Not allowed'; end if;
  select id into sh from cashier_shifts where cashier_id = auth.uid() and status='open';
  if sh is null then raise exception 'Start a shift before selling'; end if;
  if jsonb_array_length(_items) = 0 then raise exception 'Cart is empty'; end if;
  if _cash_received is not null and _payment <> 'cash' then raise exception 'Cash received only applies to cash payments'; end if;
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
  if _cash_received is not null and _cash_received < sub - _discount then raise exception 'Cash received is less than the total'; end if;
  update sales set subtotal = sub, discount = _discount, total = sub - _discount, cash_received = _cash_received where id = s_id;
  return jsonb_build_object('id',s_id,'receipt_no',rno,'total',sub-_discount,'created_at',now(),'cash_received',_cash_received);
end $$;

revoke execute on function public.complete_sale(uuid, jsonb, numeric, text, numeric) from public, anon;
grant execute on function public.complete_sale(uuid, jsonb, numeric, text, numeric) to authenticated;
