"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChevronRight, TrendingUp, TrendingDown, Bell } from "lucide-react";
import Link from "next/link";
import DashboardWrapper from "@/components/DashboardWrapper";

type Transaction = { id: string; type: "income"|"expense"; category: string; description: string; amount: number; date: string; };
type Bill = { id: string; name: string; amount: number; due_day: number; icon: string; };
type Payment = { bill_id: string; paid: boolean; month: number; year: number; };

const emoji: Record<string, string> = {
  Trabalho:"💼", Freelance:"💻", Investimento:"📈", Alimentação:"🍔",
  Transporte:"🚗", Saúde:"💊", Lazer:"🎮", Educação:"📚", Moradia:"🏠", Roupas:"👕", Outros:"💰", Contas:"🧾",
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
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      setUser(user);
      const now = new Date();
      const [txRes, billRes, payRes] = await Promise.all([
        supabase.from("transactions").select("*").eq("user_id", user?.id).order("date", { ascending: false }),
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

  const now = new Date();
  const monthTx = transactions.filter(t => {
    const d = new Date(t.date + "T00:00:00");
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthIncome = monthTx.filter(t => t.type==="income").reduce((s,t) => s+t.amount, 0);
  const monthExpense = monthTx.filter(t => t.type==="expense").reduce((s,t) => s+t.amount, 0);
  const monthResult = monthIncome - monthExpense;
  const expPct = monthIncome > 0 ? Math.min((monthExpense / monthIncome) * 100, 100) : monthExpense > 0 ? 100 : 0;
  const isGreen = monthResult >= 0;
  const monthName = now.toLocaleDateString("pt-BR", { month: "long" });

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

          {/* Saúde financeira do mês */}
          {(monthIncome > 0 || monthExpense > 0) && (
            <div className={`card border ${isGreen ? "border-brand-green/30" : "border-red-500/30"}`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-white font-bold text-sm">Saúde de {monthName}</p>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isGreen ? "bg-brand-green/10 text-brand-green" : "bg-red-500/10 text-red-400"}`}>
                  {isGreen ? "● No verde" : "● No vermelho"}
                </span>
              </div>
              <p className={`text-2xl font-bold mb-3 ${isGreen ? "text-brand-green" : "text-red-400"}`}>
                {isGreen ? "+" : ""}{fmt(monthResult)}
              </p>
              {monthIncome > 0 && (
                <>
                  <div className="h-2 bg-brand-muted rounded-full overflow-hidden mb-1.5">
                    <div className={`h-full rounded-full transition-all duration-500 ${expPct >= 100 ? "bg-red-500" : expPct >= 80 ? "bg-brand-orange" : "bg-brand-green"}`}
                      style={{ width:`${expPct}%` }}/>
                  </div>
                  <p className="text-gray-500 text-xs mb-3">
                    {isGreen ? `${Math.round(100 - expPct)}% da renda guardada` : `Gastou ${fmt(monthExpense - monthIncome)} acima da renda`}
                  </p>
                </>
              )}
              <div className="flex justify-between text-xs pt-2 border-t border-brand-border">
                <span className="text-gray-500">Entradas <span className="text-brand-green font-semibold">{fmt(monthIncome)}</span></span>
                <span className="text-gray-500">Saídas <span className="text-brand-orange font-semibold">{fmt(monthExpense)}</span></span>
              </div>
            </div>
          )}

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
                {transactions.slice(0, 5).map(tx => (
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
