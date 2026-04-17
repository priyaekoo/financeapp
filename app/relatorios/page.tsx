"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import DashboardWrapper from "@/components/DashboardWrapper";

type Transaction = { id: string; type: "income"|"expense"; category: string; description: string; amount: number; date: string; is_credit?: boolean; };
const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format(v);
const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const CAT_EMOJI: Record<string, string> = {
  Alimentação:"🍔", Transporte:"🚗", Saúde:"💊", Lazer:"🎮", Educação:"📚",
  Moradia:"🏠", Roupas:"👕", Outros:"💰", Contas:"🧾", Trabalho:"💼",
  Freelance:"💻", Investimento:"📈", "Cartão de Crédito":"💳", Gasolina:"⛽",
  "Consertos Automovéis":"🔧",
};

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
  const [deleteConfirm, setDeleteConfirm] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);
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

  async function confirmDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    await supabase.from("bill_payments").update({ paid: false, paid_at: null, transaction_id: null }).eq("transaction_id", deleteConfirm.id);
    await supabase.from("transactions").delete().eq("id", deleteConfirm.id);
    setTransactions(prev => prev.filter(t => t.id !== deleteConfirm.id));
    setDeleteConfirm(null);
    setDeleting(false);
  }

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

  // ── Dados filtrados ──
  const filtered = transactions.filter(t => {
    const d = new Date(t.date + "T00:00:00");
    if (viewMode === "monthly") {
      return d.getMonth() + 1 === filterMonth && d.getFullYear() === filterYear;
    }
    return weekRange ? d >= weekRange.start && d <= weekRange.end : false;
  });

  const totalInc = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExp = filtered.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const totalCC  = filtered.filter(t => t.type === "expense" && t.is_credit).reduce((s, t) => s + t.amount, 0);

  const byCategory = filtered.filter(t => t.type === "expense").reduce((acc, tx) => {
    acc[tx.category] = (acc[tx.category] || 0) + tx.amount; return acc;
  }, {} as Record<string, number>);
  const catData = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5);

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

          {/* Gráfico */}
          <div className="card">
            <p className="text-gray-400 text-xs mb-4 font-semibold">{chartTitle}</p>
            {chartData.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6">Sem dados ainda.</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} barGap={4} barSize={12}>
                  <XAxis dataKey="label" tick={{ fill:"#6B7280", fontSize:10 }} axisLine={false} tickLine={false}/>
                  <YAxis hide/>
                  <Tooltip contentStyle={{ background:"#111827", border:"1px solid #2D3748", borderRadius:12 }} labelStyle={{ color:"#fff" }} formatter={(v: number) => fmt(v)}/>
                  <Bar dataKey="income" fill="#00C896" radius={[6,6,0,0]} name="Entrada"/>
                  <Bar dataKey="expense" fill="#FF6B35" radius={[6,6,0,0]} name="Saída"/>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Navegação — mensal ou semanal */}
          {viewMode === "monthly" ? (
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
          ) : (
            <div className="space-y-3">
              {/* Mês de referência */}
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-white text-sm">Detalhes da semana</h2>
                <div className="flex items-center gap-2">
                  <button onClick={prevMonth} className="w-8 h-8 bg-brand-muted rounded-lg flex items-center justify-center">
                    <ChevronLeft size={16} className="text-gray-400"/>
                  </button>
                  <span className="text-white font-semibold text-sm min-w-[80px] text-center">
                    {MONTHS_PT[filterMonth-1].slice(0,3)} {filterYear}
                  </span>
                  <button onClick={nextMonth} disabled={isCurrentMonth}
                    className="w-8 h-8 bg-brand-muted rounded-lg flex items-center justify-center disabled:opacity-30">
                    <ChevronRight size={16} className="text-gray-400"/>
                  </button>
                </div>
              </div>
              {/* Tabs de semana */}
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

          {/* Totais */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card"><p className="text-gray-400 text-xs mb-1">Entradas</p><p className="text-brand-green font-bold">{fmt(totalInc)}</p></div>
            <div className="card">
              <p className="text-gray-400 text-xs mb-1">Saídas</p>
              <p className="text-brand-orange font-bold">{fmt(totalExp)}</p>
              {totalCC > 0 && <p className="text-blue-400 text-[10px] mt-0.5">💳 {fmt(totalCC)} no crédito</p>}
            </div>
          </div>

          {/* Categorias */}
          {catData.length > 0 && (
            <div className="card space-y-3">
              <p className="text-white font-bold text-sm">No que mais gastou</p>
              {catData.map(([cat, val]) => {
                const pct = totalExp > 0 ? (val / totalExp) * 100 : 0;
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-brand-muted rounded-xl flex items-center justify-center text-base shrink-0">
                      {CAT_EMOJI[cat] || "💰"}
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

          {/* Lista de transações */}
          <div className="space-y-2">
            <h2 className="font-bold text-white text-sm">Transações</h2>
            {filtered.length === 0 ? (
              <div className="card text-center py-8">
                <p className="text-gray-500 text-sm">
                  {viewMode === "monthly" ? "Nenhuma transação neste mês." : "Nenhuma transação nesta semana."}
                </p>
              </div>
            ) : (
              filtered.map(tx => (
                <div key={tx.id} className="card flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 ${tx.is_credit ? "bg-blue-500/10" : "bg-brand-muted"}`}>
                    {CAT_EMOJI[tx.category] || "💰"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{tx.description}</p>
                    <p className="text-gray-400 text-xs">{tx.category} · {new Date(tx.date+"T00:00:00").toLocaleDateString("pt-BR")}{tx.is_credit ? " · 💳" : ""}</p>
                  </div>
                  <p className={`font-bold text-sm shrink-0 ${tx.type==="income" ? "text-brand-green" : tx.is_credit ? "text-blue-400" : "text-brand-orange"}`}>
                    {tx.type==="income" ? "+" : "-"}{fmt(tx.amount)}
                  </p>
                  <button onClick={() => setDeleteConfirm(tx)}
                    className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center shrink-0">
                    <Trash2 size={13} className="text-red-400"/>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal confirmação de exclusão */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-end" onClick={() => setDeleteConfirm(null)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"/>
          <div className="relative w-full max-w-md mx-auto bg-[#111827] border-t border-brand-border rounded-t-3xl px-6 pt-5 pb-10 space-y-4"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-brand-border rounded-full mx-auto"/>
            <div className="flex items-start gap-3">
              <span className="text-2xl">🗑️</span>
              <div>
                <p className="text-white font-bold text-base">Excluir transação?</p>
                <p className="text-gray-400 text-sm mt-1 leading-relaxed">"{deleteConfirm.description}" · {fmt(deleteConfirm.amount)}</p>
                <p className="text-gray-500 text-xs mt-1">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                className="flex-1 py-3.5 rounded-xl font-semibold text-sm bg-brand-muted text-gray-300 border border-brand-border active:scale-95 transition-all"
                onClick={() => setDeleteConfirm(null)}>
                Cancelar
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                className="flex-1 py-3.5 rounded-xl font-semibold text-sm bg-red-500 text-white active:scale-95 transition-all disabled:opacity-50">
                {deleting ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardWrapper>
  );
}
