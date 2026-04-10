"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChevronRight, TrendingUp, TrendingDown, Bell } from "lucide-react";
import Link from "next/link";
import DashboardWrapper from "@/components/DashboardWrapper";

type Transaction = { id: string; type: "income"|"expense"; category: string; description: string; amount: number; date: string; };
type Bill = { id: string; name: string; amount: number; due_day: number; icon: string; };
type Payment = { bill_id: string; paid: boolean; month: number; year: number; };

const emoji: Record<string, string> = {
  Trabalho:"💼", Freelance:"💻", Investimento:"📈", Alimentação:"🍔",
  Transporte:"🚗", Saúde:"💊", Lazer:"🎮", Educação:"📚", Moradia:"🏠", Roupas:"👕", Outros:"💰",
};

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format(v);

function fmtDate(d: string) {
  const dt = new Date(d + "T00:00:00");
  const today = new Date(); const yest = new Date(today); yest.setDate(today.getDate()-1);
  if (dt.toDateString()===today.toDateString()) return "Hoje";
  if (dt.toDateString()===yest.toDateString()) return "Ontem";
  return dt.toLocaleDateString("pt-BR", { day:"numeric", month:"short" });
}

export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      const now = new Date();
      const [txRes, billRes, payRes] = await Promise.all([
        supabase.from("transactions").select("*").eq("user_id", user?.id).order("date", { ascending: false }).limit(5),
        supabase.from("bills").select("*").eq("user_id", user?.id).eq("active", true),
        supabase.from("bill_payments").select("*").eq("user_id", user?.id).eq("month", now.getMonth()+1).eq("year", now.getFullYear()),
      ]);
      setTransactions(txRes.data || []);
      setBills(billRes.data || []);
      setPayments(payRes.data || []);
      setLoading(false);
    }
    load();
  }, []);

  const income = transactions.filter(t => t.type==="income").reduce((s,t) => s+t.amount, 0);
  const expense = transactions.filter(t => t.type==="expense").reduce((s,t) => s+t.amount, 0);
  const balance = income - expense;
  const name = user?.user_metadata?.name?.split(" ")[0] || "Você";

  const unpaidBills = bills.filter(b => !payments.find(p => p.bill_id===b.id && p.paid));
  const totalUnpaid = unpaidBills.reduce((s,b) => s+b.amount, 0);

  return (
    <DashboardWrapper>
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Olá, <span className="text-white font-semibold">{name}</span> 👋</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {new Date().toLocaleDateString("pt-BR", { weekday:"long", day:"numeric", month:"long" })}
              </p>
            </div>
            <div className="w-10 h-10 bg-brand-muted rounded-full flex items-center justify-center">
              <Bell size={18} className="text-gray-400" />
            </div>
          </div>

          {/* Saldo */}
          <div className="rounded-3xl p-5 relative overflow-hidden" style={{ background:"linear-gradient(135deg,#00C896 0%,#00A87A 100%)" }}>
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full" />
            <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-white/5 rounded-full" />
            <p className="text-green-900/70 text-xs font-medium mb-1">Saldo total</p>
            <p className="text-brand-dark text-3xl font-bold tracking-tight mb-4">{fmt(balance)}</p>
            <div className="flex gap-3">
              <Link href="/adicionar?type=income" className="flex-1 bg-white/20 backdrop-blur rounded-xl py-2.5 flex items-center justify-center gap-1.5 text-brand-dark font-semibold text-xs active:scale-95 transition-transform">
                <TrendingUp size={14} />+ Entrada
              </Link>
              <Link href="/adicionar?type=expense" className="flex-1 bg-brand-dark/20 backdrop-blur rounded-xl py-2.5 flex items-center justify-center gap-1.5 text-brand-dark font-semibold text-xs active:scale-95 transition-transform">
                <TrendingDown size={14} />+ Saída
              </Link>
            </div>
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card"><p className="text-gray-400 text-xs mb-1">Entradas</p><p className="text-brand-green font-bold text-base">{fmt(income)}</p></div>
            <div className="card"><p className="text-gray-400 text-xs mb-1">Saídas</p><p className="text-brand-orange font-bold text-base">{fmt(expense)}</p></div>
          </div>

          {/* Alerta de contas pendentes */}
          {unpaidBills.length > 0 && (
            <Link href="/contas" className="card flex items-center gap-3 border-orange-500/30 bg-orange-500/5 active:scale-95 transition-transform">
              <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center text-lg shrink-0">🔔</div>
              <div className="flex-1">
                <p className="text-white text-sm font-semibold">{unpaidBills.length} conta{unpaidBills.length>1?"s":""} pendente{unpaidBills.length>1?"s":""}</p>
                <p className="text-gray-400 text-xs">Total: {fmt(totalUnpaid)}</p>
              </div>
              <ChevronRight size={16} className="text-gray-500" />
            </Link>
          )}

          {/* Últimas transações */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-white text-sm">Últimas movimentações</h2>
              <Link href="/relatorios" className="text-brand-green text-xs flex items-center gap-1">Ver tudo <ChevronRight size={12} /></Link>
            </div>
            {transactions.length === 0 ? (
              <div className="card text-center py-8">
                <p className="text-gray-500 text-sm">Nenhuma movimentação ainda.</p>
                <Link href="/adicionar" className="text-brand-green text-sm mt-1 inline-block">Adicionar primeira →</Link>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map(tx => (
                  <div key={tx.id} className="card flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand-muted rounded-xl flex items-center justify-center text-lg shrink-0">{emoji[tx.category]||"💳"}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm truncate">{tx.description}</p>
                      <p className="text-gray-400 text-xs">{fmtDate(tx.date)}</p>
                    </div>
                    <p className={`font-bold text-sm shrink-0 ${tx.type==="income"?"text-brand-green":"text-brand-orange"}`}>
                      {tx.type==="income"?"+":"-"}{fmt(tx.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </DashboardWrapper>
  );
}
