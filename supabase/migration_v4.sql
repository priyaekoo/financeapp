-- Migration v4 — Execute no SQL Editor do Supabase
-- Seguro: usa DEFAULT, não afeta dados existentes

-- Suporte a cartão de crédito (is_credit = false por padrão → comportamento antigo mantido)
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS is_credit boolean DEFAULT false;

-- Tipo de reserva: 'goal' (meta com valor alvo) ou 'investment' (aplicação livre)
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS goal_type text DEFAULT 'goal';
