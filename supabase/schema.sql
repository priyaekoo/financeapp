-- =============================================
-- SCHEMA: FinanceApp v3 — Execute no SQL Editor do Supabase
-- =============================================

-- Transações (entradas e saídas)
create table if not exists public.transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text check (type in ('income', 'expense')) not null,
  category text not null,
  description text not null,
  amount numeric(12, 2) not null,
  date date not null default current_date,
  is_credit boolean default false,  -- true = gasto no cartão, não desconta saldo imediatamente
  created_at timestamptz default now()
);

-- Contas do mês (fixas recorrentes)
create table if not exists public.bills (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  amount numeric(12, 2) not null,
  due_day integer not null default 10,
  icon text default '💡',
  active boolean default true,
  created_at timestamptz default now()
);

-- Pagamentos mensais das contas
create table if not exists public.bill_payments (
  id uuid default gen_random_uuid() primary key,
  bill_id uuid references public.bills(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  month integer not null,
  year integer not null,
  paid boolean default false,
  paid_at timestamptz,
  amount_paid numeric(12, 2),
  created_at timestamptz default now(),
  unique(bill_id, month, year)
);

-- Metas / Reservas
create table if not exists public.goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  icon text default '🎯',
  target_amount numeric(12, 2) not null default 0,
  saved_amount numeric(12, 2) default 0,
  color text default '#00C896',
  goal_type text default 'goal',  -- 'goal' = meta com valor alvo | 'investment' = aplicação livre (🤑)
  created_at timestamptz default now()
);

-- RLS
alter table public.transactions enable row level security;
alter table public.bills enable row level security;
alter table public.bill_payments enable row level security;
alter table public.goals enable row level security;

create policy "own transactions" on public.transactions for all using (auth.uid() = user_id);
create policy "own bills" on public.bills for all using (auth.uid() = user_id);
create policy "own bill_payments" on public.bill_payments for all using (auth.uid() = user_id);
create policy "own goals" on public.goals for all using (auth.uid() = user_id);
