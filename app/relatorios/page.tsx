"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import DashboardWrapper from "@/components/DashboardWrapper";

type Transaction = { id: string; type: "income"|"expense"; category: string; description: string; amount: number; date: string; is_credit?: boolean; };
const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format(v);
const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
// Gera semanas qui→qua para o mês informado
function getMonthWeeks(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay  = new Date(year, month, 0);

  // Quinta-feira mais próxima anterior ao dia 1
  const dow = firstDay.getDay(); // 0=Dom … 4=Qui
  const offset = (dow - 4 + 7) % 7;
  const thu = new Date(firstDay);
  thu.setDate(thu.getDate() - offset);

  const weeks: { label: string; start: Date; end: Date }[] = [];
  let cur = new Date(thu);
  let n = 1;
  while (cur <= lastDay) {
    const wed = new Date(cur);
    wed.setDate(wed.getDate() + 6);
    if (wed >= firstDay) {
      weeks.push({ label: `Semana ${n}`, start: new Date(cur), end: new Date(wed) });
      n++;
    }
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}

export default function RelatoriosPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"monthly"|"weekly">("monthly");
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear]   = useState(new Date().getFullYear());
  const [filterWeek, setFilterWeek]   = useState(0);
  const supabase = createClient();
  const router   = useRouter();

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

  // ── Navegação mensal ──
  function prevMonth() {
    if (filterMonth === 1) { setFilterMonth(12); setFilterYear(y => y - 1); }
    else setFilterMonth(m => m - 1);
    setFilterWeek(0);
  }
  function nextMonth() {
    const now = new Date();
    if (filterYear > now.getFullYear() || (filterYear === now.getFullYear() && filterMonth >= now.getMonth() + 1)) return;
    if (filterMonth === 12) { setFilterMonth(1); setFilterYear(y => y + 1); }
    else setFilterMonth(m => m + 1);
    setFilterWeek(0);
  }
  const isCurrentMonth = filterMonth === new Date().getMonth() + 1 && filterYear === new Date().getFullYear();

  // ── Semanas do mês selecionado ──
  const weekRanges = getMonthWeeks(filterYear, filterMonth);
  const safeWeek   = Math.min(filterWeek, weekRanges.length - 1);
  const weekRange  = weekRanges[safeWeek];

  // ── Gráfico mensal (últimos 6 meses) ──
  const byMonth = transactions.reduce((acc, tx) => {
    const d = new Date(tx.date + "T00:00:00");
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!acc[key]) acc[key] = { label: MONTHS[d.getMonth()], income: 0, expense: 0, order: d.getFullYear() * 100 + d.getMonth() };
    tx.type === "income" ? (acc[key].income += tx.amount) : (acc[key].expense += tx.amount);
    return acc;
  }, {} as Record<string, any>);
  const monthChartData = Object.values(byMonth).sort((a, b) => a.order - b.order).slice(-6);

  // ── Gráfico semanal (4 semanas do mês selecionado) ──
  const weekChartData = weekRanges.map((wr, i) => {
    const txs = transactions.filter(t => {
      const d = new Date(t.date + "T00:00:00");
      return d >= wr.start && d <= wr.end;
    });
    return {
      label: `Sem ${i + 1}`,
      income:  txs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0),
      expense: txs.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0),
    };
  });

  const chartData = viewMode === "monthly" ? monthChartData : weekChartData;
  const chartTitle = viewMode === "monthly" ? "Entradas vs Saídas (últimos 6 meses)" : `Entradas vs Saídas — ${MONTHS_PT[filterMonth-1]}`;

  return (
    <DashboardWrapper>
      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin"/></div>
      ) : (
        <div className="space-y-5">

          {/* Header + toggle */}
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Relatórios</h1>
            <div className="flex bg-brand-muted rounded-xl p-1 gap-1">
              {(["monthly","weekly"] as const).map(m => (
                <button key={m} onClick={() => { setViewMode(m); setFilterWeek(0); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${viewMode===m ? "bg-brand-green text-brand-dark" : "text-gray-400"}`}>
                  {m === "monthly" ? "Mensal" : "Semanal"}
                </button>
              ))}
            </div>
          </div>

          {/* Navegação de mês (modo semanal) */}
          {viewMode === "weekly" && (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2">
                <button onClick={prevMonth} className="w-8 h-8 bg-brand-muted rounded-lg flex items-center justify-center">
                  <ChevronLeft size={16} className="text-gray-400"/>
                </button>
                <span className="text-white font-semibold text-sm min-w-[110px] text-center">
                  {MONTHS_PT[filterMonth-1]} {filterYear}
                </span>
                <button onClick={nextMonth} disabled={isCurrentMonth}
                  className="w-8 h-8 bg-brand-muted rounded-lg flex items-center justify-center disabled:opacity-30">
                  <ChevronRight size={16} className="text-gray-400"/>
                </button>
              </div>
              <div className="flex gap-2">
                {weekRanges.map((wr, i) => (
                  <button key={i} onClick={() => setFilterWeek(i)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${safeWeek===i ? "bg-brand-green text-brand-dark" : "bg-brand-muted text-gray-400 border border-brand-border"}`}>
                    Sem {i + 1}
                  </button>
                ))}
              </div>
              {weekRange && (
                <p className="text-gray-500 text-[11px] text-center">
                  {weekRange.start.toLocaleDateString("pt-BR",{day:"numeric",month:"short"})} → {weekRange.end.toLocaleDateString("pt-BR",{day:"numeric",month:"short"})}
                </p>
              )}
            </div>
          )}

          {/* Gráfico */}
          <div className="card">
            <p className="text-gray-400 text-xs mb-4 font-semibold">{chartTitle}</p>
            {chartData.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6">Sem dados ainda.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} barGap={4} barSize={14}>
                  <XAxis dataKey="label" tick={{ fill:"#6B7280", fontSize:10 }} axisLine={false} tickLine={false}/>
                  <YAxis hide/>
                  <Tooltip contentStyle={{ background:"#111827", border:"1px solid #2D3748", borderRadius:12 }} labelStyle={{ color:"#fff" }} formatter={(v: number) => fmt(v)}/>
                  <Bar dataKey="income" fill="#00C896" radius={[6,6,0,0]} name="Entrada"/>
                  <Bar dataKey="expense" fill="#FF6B35" radius={[6,6,0,0]} name="Saída"/>
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="flex justify-center gap-6 mt-3">
              <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-2.5 h-2.5 rounded-full bg-brand-green inline-block"/>Entradas</span>
              <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className="w-2.5 h-2.5 rounded-full bg-brand-orange inline-block"/>Saídas</span>
            </div>
          </div>

        </div>
      )}
    </DashboardWrapper>
  );
}
