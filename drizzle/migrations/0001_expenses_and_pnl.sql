
create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0
);
grant select on public.expense_categories to authenticated;
grant all on public.expense_categories to service_role;
alter table public.expense_categories enable row level security;
create policy "admins read expense cats" on public.expense_categories for select to authenticated using (public.is_staff_admin(auth.uid()));

insert into public.expense_categories(name, sort_order)
select n, ord from unnest(array['Rent','Electricity','Water','Salaries','Security','Entertainment','DJ','Repairs','Licenses','Internet','Cleaning','Transport','Marketing','Maintenance','Supplies','Other']) with ordinality as t(n, ord);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.expense_categories(id),
  amount numeric(12,2) not null check (amount > 0),
  expense_date date not null default (now() at time zone 'Africa/Nairobi')::date,
  description text not null default '',
  payment_method text not null default 'cash' check (payment_method in ('cash','mpesa','card','bank','other')),
  reference text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid,
  void_reason text
);
create index on public.expenses(expense_date);
grant select, insert on public.expenses to authenticated;
grant all on public.expenses to service_role;
alter table public.expenses enable row level security;
create policy "admins read expenses" on public.expenses for select to authenticated using (public.is_staff_admin(auth.uid()));
create policy "admins add expenses" on public.expenses for insert to authenticated
  with check (public.is_staff_admin(auth.uid()) and created_by = auth.uid() and voided_at is null);

create or replace function public.audit_expense_insert() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.log_audit('expense_create','expense',new.id::text,null,to_jsonb(new));
  return new;
end $$;
create trigger expenses_audit after insert on public.expenses for each row execute function public.audit_expense_insert();

create or replace function public.void_expense(_id uuid, _reason text)
returns void language plpgsql security definer set search_path = public as $$
declare e expenses;
begin
  if not public.has_role(auth.uid(),'owner') then raise exception 'Not allowed'; end if;
  if coalesce(trim(_reason),'') = '' then raise exception 'A note is required'; end if;
  select * into e from expenses where id = _id for update;
  if e.id is null or e.voided_at is not null then raise exception 'Expense not found'; end if;
  update expenses set voided_at = now(), voided_by = auth.uid(), void_reason = trim(_reason) where id = _id;
  perform log_audit('expense_void','expense',_id::text,to_jsonb(e),jsonb_build_object('reason',_reason));
end $$;
revoke execute on function public.void_expense(uuid,text) from public, anon;
grant execute on function public.void_expense(uuid,text) to authenticated;

-- P&L for a Nairobi-local date range [start, end] inclusive; one row per day
create or replace function public.pnl_daily(_start date, _end date)
returns table(day date, revenue numeric, cogs numeric, expenses numeric, transactions bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff_admin(auth.uid()) then raise exception 'Not allowed'; end if;
  if _end < _start or _end - _start > 800 then raise exception 'Invalid date range'; end if;
  return query
  with days as (select generate_series(_start, _end, interval '1 day')::date d),
  s as (
    select (created_at at time zone 'Africa/Nairobi')::date d, sum(total) rev, count(*) n
    from sales where status='completed'
      and created_at >= (_start::timestamp at time zone 'Africa/Nairobi')
      and created_at < ((_end + 1)::timestamp at time zone 'Africa/Nairobi')
    group by 1),
  c as (
    select (sa.created_at at time zone 'Africa/Nairobi')::date d, sum(sic.total_cost) cg
    from sales sa join sale_items si on si.sale_id = sa.id join sale_item_costs sic on sic.sale_item_id = si.id
    where sa.status='completed'
      and sa.created_at >= (_start::timestamp at time zone 'Africa/Nairobi')
      and sa.created_at < ((_end + 1)::timestamp at time zone 'Africa/Nairobi')
    group by 1),
  e as (
    select expense_date d, sum(amount) ex from expenses
    where voided_at is null and expense_date between _start and _end group by 1)
  select days.d, coalesce(s.rev,0), coalesce(c.cg,0), coalesce(e.ex,0), coalesce(s.n,0)
  from days left join s on s.d = days.d left join c on c.d = days.d left join e on e.d = days.d
  order by days.d;
end $$;

create or replace function public.expense_breakdown(_start date, _end date)
returns table(category text, total numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_staff_admin(auth.uid()) then raise exception 'Not allowed'; end if;
  return query select ec.name, sum(x.amount) from expenses x join expense_categories ec on ec.id = x.category_id
    where x.voided_at is null and x.expense_date between _start and _end
    group by ec.name order by 2 desc;
end $$;
revoke execute on function public.pnl_daily(date,date), public.expense_breakdown(date,date) from public, anon;
grant execute on function public.pnl_daily(date,date), public.expense_breakdown(date,date) to authenticated;
