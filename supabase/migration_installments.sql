-- Parcelamentos — execute no SQL Editor do Supabase
create table if not exists public.installments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  card_name text not null,
  purchase_name text not null,
  total_amount numeric(12, 2) not null,
  installment_count integer not null,
  start_month integer not null,
  start_year integer not null,
  created_at timestamptz default now()
);

alter table public.installments enable row level security;
create policy "own installments" on public.installments for all using (auth.uid() = user_id);
