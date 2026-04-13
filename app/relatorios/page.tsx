"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import DashboardWrapper from "@/components/DashboardWrapper";

type Transaction = { id: string; type: "income"|"expense"; category: string; description: string; amount: number; date: string; };
const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format(v);
const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const CAT_EMOJI: Record<string, string> = {
  Alimentação:"🍔", Transporte:"🚗", Saúde:"💊", Lazer:"🎮", Educação:"📚",
  Moradia:"🏠", Roupas:"👕", Outros:"💰", Contas:"🧾", Trabalho:"💼", Freelance:"💻", Investimento:"📈",
};

export default function RelatoriosPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
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

  async function deleteTransaction(id: string) {
    await supabase.from("bill_payments").update({ paid: false, paid_at: null, transaction_id: null }).eq("transaction_id", id);
    await supabase.from("transactions").delete().eq("id", id);
    setTransactions(prev => prev.filter(t => t.id !== id));
  }

  function prevMonth() {
    if (filterMonth === 1) { setFilterMonth(12); setFilterYear(y => y - 1); }
    else setFilterMonth(m => m - 1);
  }
  function nextMonth() {
    const now = new Date();
    if (filterYear > now.getFullYear() || (filterYear === now.getFullYear() && filterMonth >= now.getMonth() + 1)) return;
    if (filterMonth === 12) { setFilterMonth(1); setFilterYear(y => y + 1); }
    else setFilterMonth(m => m + 1);
  }

  const isCurrentMonth = filterMonth === new Date().getMonth() + 1 && filterYear === new Date().getFullYear();

  const filtered = transactions.filter(t => {
    const d = new Date(t.date + "T00:00:00");
    return d.getMonth() + 1 === filterMonth && d.getFullYear() === filterYear;
  });

  const totalInc = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExp = filtered.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  const byCategory = filtered.filter(t => t.type === "expense").reduce((acc, tx) => {
    acc[tx.category] = (acc[tx.category] || 0) + tx.amount; return acc;
  }, {} as Record<string, number>);
  const catData = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const byMonth = transactions.reduce((acc, tx) => {
    const d = new Date(tx.date + "T00:00:00");
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const label = MONTHS[d.getMonth()];
    if (!acc[key]) acc[key] = { month: label, income: 0, expense: 0, order: d.getFullYear() * 100 + d.getMonth() };
    tx.type === "income" ? (acc[key].income += tx.amount) : (acc[key].expense += tx.amount);
    return acc;
  }, {} as Record<string, any>);
  const chartData = Object.values(byMonth).sort((a, b) => a.order - b.order).slice(-6);

  return (
    <DashboardWrapper>
      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin"/></div>
      ) : (
        <div className="space-y-5">
          <h1 className="text-xl font-bold">Relatórios</h1>

          {/* Gráfico 6 meses — sempre visão geral */}
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

          {/* Filtro por mês */}
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white text-sm">Detalhes do mês</h2>
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="w-8 h-8 bg-brand-muted rounded-lg flex items-center justify-center">
                <ChevronLeft size={16} className="text-gray-400"/>
              </button>
              <span className="text-white font-semibold text-sm min-w-[110px] text-center">
                {MONTHS_PT[filterMonth-1].slice(0,3)} {filterYear}
              </span>
              <button onClick={nextMonth} disabled={isCurrentMonth}
                className="w-8 h-8 bg-brand-muted rounded-lg flex items-center justify-center disabled:opacity-30">
                <ChevronRight size={16} className="text-gray-400"/>
              </button>
            </div>
          </div>

          {/* Totais do mês filtrado */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card"><p className="text-gray-400 text-xs mb-1">Entradas</p><p className="text-brand-green font-bold">{fmt(totalInc)}</p></div>
            <div className="card"><p className="text-gray-400 text-xs mb-1">Saídas</p><p className="text-brand-orange font-bold">{fmt(totalExp)}</p></div>
          </div>

          {/* Categorias do mês */}
          {catData.length > 0 && (
            <div className="card space-y-3">
              <p className="text-white font-bold text-sm">No que mais gastou</p>
              {catData.map(([cat, val], i) => {
                const pct = totalExp > 0 ? (val / totalExp) * 100 : 0;
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-brand-muted rounded-xl flex items-center justify-center text-base shrink-0">
                      {CAT_EMOJI[cat] || "💳"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-white font-medium">{cat}</span>
                        <span className="text-brand-orange font-semibold">{fmt(val)}</span>
                      </div>
                      <div className="h-1.5 bg-brand-muted rounded-full overflow-hidden">
                        <div className="h-full bg-brand-orange rounded-full transition-all duration-500" style={{ width:`${pct}%` }}/>
                      </div>
                      <p className="text-gray-600 text-[10px] mt-0.5">{Math.round(pct)}% das saídas</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Lista de transações do mês */}
          <div className="space-y-2">
            <h2 className="font-bold text-white text-sm">Transações</h2>
            {filtered.length === 0 ? (
              <div className="card text-center py-8"><p className="text-gray-500 text-sm">Nenhuma transação neste mês.</p></div>
            ) : (
              filtered.map(tx => (
                <div key={tx.id} className="card flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{tx.description}</p>
                    <p className="text-gray-400 text-xs">{tx.category} · {new Date(tx.date+"T00:00:00").toLocaleDateString("pt-BR")}</p>
                  </div>
                  <p className={`font-bold text-sm shrink-0 ${tx.type==="income"?"text-brand-green":"text-brand-orange"}`}>
                    {tx.type==="income"?"+":"-"}{fmt(tx.amount)}
                  </p>
                  <button onClick={() => deleteTransaction(tx.id)}
                    className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center shrink-0">
                    <Trash2 size={13} className="text-red-400"/>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </DashboardWrapper>
  );
}
