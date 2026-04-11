"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import DashboardWrapper from "@/components/DashboardWrapper";

type Transaction = { id: string; type: "income"|"expense"; category: string; description: string; amount: number; date: string; };
const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format(v);
const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export default function RelatoriosPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      const { data } = await supabase.from("transactions").select("*").eq("user_id", user?.id).order("date", { ascending: false });
      setTransactions(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const byMonth = transactions.reduce((acc, tx) => {
    const m = MONTHS[new Date(tx.date + "T00:00:00").getMonth()];
    if (!acc[m]) acc[m] = { month: m, income: 0, expense: 0 };
    tx.type==="income" ? (acc[m].income += tx.amount) : (acc[m].expense += tx.amount);
    return acc;
  }, {} as Record<string, any>);

  const chartData = Object.values(byMonth).slice(-6);

  const byCategory = transactions.filter(t => t.type==="expense").reduce((acc, tx) => {
    acc[tx.category] = (acc[tx.category]||0) + tx.amount; return acc;
  }, {} as Record<string, number>);

  const catData = Object.entries(byCategory).sort((a,b) => b[1]-a[1]).slice(0,5);
  const totalExp = transactions.filter(t => t.type==="expense").reduce((s,t) => s+t.amount, 0);
  const totalInc = transactions.filter(t => t.type==="income").reduce((s,t) => s+t.amount, 0);

  return (
    <DashboardWrapper>
      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin"/></div>
      ) : (
        <div className="space-y-5">
          <h1 className="text-xl font-bold">Relatórios</h1>

          <div className="grid grid-cols-2 gap-3">
            <div className="card"><p className="text-gray-400 text-xs mb-1">Total entradas</p><p className="text-brand-green font-bold">{fmt(totalInc)}</p></div>
            <div className="card"><p className="text-gray-400 text-xs mb-1">Total saídas</p><p className="text-brand-orange font-bold">{fmt(totalExp)}</p></div>
          </div>

          <div className="card">
            <p className="text-gray-400 text-xs mb-4 font-semibold">Entradas vs Saídas (últimos 6 meses)</p>
            {chartData.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6">Sem dados ainda.</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} barGap={4} barSize={12}>
                  <XAxis dataKey="month" tick={{ fill:"#6B7280", fontSize:10 }} axisLine={false} tickLine={false}/>
                  <YAxis hide/>
                  <Tooltip contentStyle={{ background:"#111827", border:"1px solid #2D3748", borderRadius:12 }} labelStyle={{ color:"#fff" }} formatter={(v: number) => fmt(v)}/>
                  <Bar dataKey="income" fill="#00C896" radius={[6,6,0,0]} name="Entrada"/>
                  <Bar dataKey="expense" fill="#FF6B35" radius={[6,6,0,0]} name="Saída"/>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {catData.length > 0 && (
            <div className="card space-y-3">
              <p className="text-gray-400 text-xs font-semibold">Maiores gastos por categoria</p>
              {catData.map(([cat, val]) => {
                const pct = totalExp > 0 ? (val/totalExp)*100 : 0;
                return (
                  <div key={cat}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-white font-medium">{cat}</span>
                      <span className="text-gray-400">{fmt(val)}</span>
                    </div>
                    <div className="h-2 bg-brand-muted rounded-full overflow-hidden">
                      <div className="h-full bg-brand-orange rounded-full" style={{ width:`${pct}%` }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-2">
            <h2 className="font-bold text-white text-sm">Todas as transações</h2>
            {transactions.length === 0 ? (
              <div className="card text-center py-8"><p className="text-gray-500 text-sm">Nenhuma transação ainda.</p></div>
            ) : (
              transactions.map(tx => (
                <div key={tx.id} className="card flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{tx.description}</p>
                    <p className="text-gray-400 text-xs">{tx.category} · {new Date(tx.date+"T00:00:00").toLocaleDateString("pt-BR")}</p>
                  </div>
                  <p className={`font-bold text-sm shrink-0 ${tx.type==="income"?"text-brand-green":"text-brand-orange"}`}>
                    {tx.type==="income"?"+":"-"}{fmt(tx.amount)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </DashboardWrapper>
  );
}
