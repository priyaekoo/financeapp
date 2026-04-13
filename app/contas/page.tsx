"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Check, X, Trash2, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import DashboardWrapper from "@/components/DashboardWrapper";

type Bill = { id: string; name: string; amount: number; due_day: number; icon: string; active: boolean; };
type Payment = { id: string; bill_id: string; paid: boolean; month: number; year: number; paid_at: string | null; transaction_id: string | null; };
type BillWithStatus = Bill & { isPaid: boolean; isOverdue: boolean; isToday: boolean; payment: Payment | undefined; };
type ConfirmState = { bill: BillWithStatus; action: "pay" | "unpay" | "delete" } | null;

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format(v);
function maskBRL(v: string) {
  const digits = v.replace(/\D/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseInt(digits) / 100);
}
function parseBRL(v: string) {
  return parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;
}
const ICONS = ["💡","📶","🏠","💧","📺","🚗","📱","🎓","💪","🛒","🐶","❤️"];
const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

export default function ContasPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("10");
  const [icon, setIcon] = useState("💡");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all"|"pending"|"paid">("all");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const supabase = createClient();
  const router = useRouter();

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/login"); return; }
    const [billRes, payRes] = await Promise.all([
      supabase.from("bills").select("*").eq("user_id", user?.id).eq("active", true).order("due_day"),
      supabase.from("bill_payments").select("*").eq("user_id", user?.id).eq("month", month).eq("year", year),
    ]);
    setBills(billRes.data || []);
    setPayments(payRes.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [month, year]);

  async function addBill() {
    if (!name || !amount) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("bills").insert({
      user_id: user?.id, name, amount: parseBRL(amount),
      due_day: parseInt(dueDay), icon, active: true,
    }).select().single();
    if (!error && data) {
      setBills(prev => [...prev, data].sort((a,b) => a.due_day - b.due_day));
      setName(""); setAmount(""); setDueDay("10"); setIcon("💡"); setShowForm(false);
    }
    setSaving(false);
  }

  async function togglePayment(bill: BillWithStatus) {
    const { data: { user } } = await supabase.auth.getUser();
    const existing = payments.find(p => p.bill_id === bill.id);
    const today = new Date().toISOString().split("T")[0];

    if (existing) {
      const nowPaid = !existing.paid;
      if (nowPaid) {
        const { data: tx } = await supabase.from("transactions").insert({
          user_id: user?.id, type: "expense", category: "Contas",
          description: bill.name, amount: bill.amount, date: today,
        }).select().single();
        await supabase.from("bill_payments").update({
          paid: true, paid_at: new Date().toISOString(), transaction_id: tx?.id ?? null,
        }).eq("id", existing.id);
        setPayments(prev => prev.map(p => p.id===existing.id ? { ...p, paid: true, paid_at: new Date().toISOString(), transaction_id: tx?.id ?? null } : p));
      } else {
        if (existing.transaction_id) {
          await supabase.from("transactions").delete().eq("id", existing.transaction_id);
        }
        await supabase.from("bill_payments").update({
          paid: false, paid_at: null, transaction_id: null,
        }).eq("id", existing.id);
        setPayments(prev => prev.map(p => p.id===existing.id ? { ...p, paid: false, paid_at: null, transaction_id: null } : p));
      }
    } else {
      const { data: tx } = await supabase.from("transactions").insert({
        user_id: user?.id, type: "expense", category: "Contas",
        description: bill.name, amount: bill.amount, date: today,
      }).select().single();
      const { data } = await supabase.from("bill_payments").insert({
        bill_id: bill.id, user_id: user?.id, month, year,
        paid: true, paid_at: new Date().toISOString(), amount_paid: bill.amount,
        transaction_id: tx?.id ?? null,
      }).select().single();
      if (data) setPayments(prev => [...prev, data]);
    }
  }

  async function deleteBill(id: string) {
    await supabase.from("bills").update({ active: false }).eq("id", id);
    setBills(prev => prev.filter(b => b.id !== id));
  }

  async function handleConfirm() {
    if (!confirm) return;
    setSaving(true);
    if (confirm.action === "delete") {
      await deleteBill(confirm.bill.id);
    } else {
      await togglePayment(confirm.bill);
    }
    setSaving(false);
    setConfirm(null);
  }

  function getConfirmContent() {
    if (!confirm) return null;
    const { bill, action } = confirm;
    if (action === "delete") return {
      icon: "🗑️",
      title: `Remover "${bill.name}"?`,
      desc: "A conta fixa será removida e não aparecerá mais nos próximos meses.",
      btnLabel: "Remover conta",
      danger: true,
    };
    if (action === "unpay") return {
      icon: "↩️",
      title: "Desmarcar pagamento?",
      desc: `O valor de ${fmt(bill.amount)} será removido das saídas do mês.`,
      btnLabel: "Desmarcar",
      danger: false,
    };
    if (bill.isOverdue) return {
      icon: "⚠️",
      title: "Conta vencida",
      desc: `Esta conta venceu no dia ${bill.due_day}. Deseja registrar o pagamento assim mesmo? O valor de ${fmt(bill.amount)} será lançado como saída.`,
      btnLabel: "Marcar como paga",
      danger: false,
    };
    if (bill.isToday) return {
      icon: "📅",
      title: "Vence hoje!",
      desc: `Confirmar o pagamento de "${bill.name}"? O valor de ${fmt(bill.amount)} será registrado como saída.`,
      btnLabel: "Confirmar pagamento",
      danger: false,
    };
    return {
      icon: "✅",
      title: "Confirmar pagamento",
      desc: `Marcar "${bill.name}" como paga? O valor de ${fmt(bill.amount)} será registrado como saída.`,
      btnLabel: "Confirmar",
      danger: false,
    };
  }

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1);
  }
  function nextMonth() {
    const now = new Date();
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth()+1)) return;
    if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1);
  }

  const isCurrentMonth = month === new Date().getMonth()+1 && year === new Date().getFullYear();
  const today = new Date().getDate();

  const billsWithStatus: BillWithStatus[] = bills.map(b => {
    const payment = payments.find(p => p.bill_id === b.id);
    const isPaid = payment?.paid || false;
    const isOverdue = !isPaid && isCurrentMonth && today > b.due_day;
    const isToday = !isPaid && isCurrentMonth && today === b.due_day;
    return { ...b, isPaid, isOverdue, isToday, payment };
  });

  const filtered = billsWithStatus.filter(b => {
    if (filter === "paid") return b.isPaid;
    if (filter === "pending") return !b.isPaid;
    return true;
  });

  const totalBills = bills.reduce((s,b) => s+b.amount, 0);
  const totalPaid = billsWithStatus.filter(b => b.isPaid).reduce((s,b) => s+b.amount, 0);
  const totalPending = totalBills - totalPaid;
  const paidCount = billsWithStatus.filter(b => b.isPaid).length;
  const pct = bills.length > 0 ? Math.round((paidCount / bills.length) * 100) : 0;
  const confirmContent = getConfirmContent();

  return (
    <DashboardWrapper>
      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin"/></div>
      ) : (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Contas</h1>
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} className="w-8 h-8 bg-brand-muted rounded-lg flex items-center justify-center">
                <ChevronLeft size={16} className="text-gray-400"/>
              </button>
              <span className="text-white font-semibold text-sm min-w-[90px] text-center">
                {MONTHS_PT[month-1].slice(0,3)} {year}
              </span>
              <button onClick={nextMonth} disabled={isCurrentMonth}
                className="w-8 h-8 bg-brand-muted rounded-lg flex items-center justify-center disabled:opacity-30">
                <ChevronRight size={16} className="text-gray-400"/>
              </button>
            </div>
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-3 gap-2">
            <div className="card p-3"><p className="text-gray-400 text-[10px] mb-1">Total</p><p className="text-white font-bold text-sm">{fmt(totalBills)}</p></div>
            <div className="card p-3"><p className="text-gray-400 text-[10px] mb-1">Pago</p><p className="text-brand-green font-bold text-sm">{fmt(totalPaid)}</p></div>
            <div className="card p-3"><p className="text-gray-400 text-[10px] mb-1">Pendente</p><p className="text-brand-orange font-bold text-sm">{fmt(totalPending)}</p></div>
          </div>

          {/* Barra de progresso */}
          {bills.length > 0 && (
            <div className="card">
              <div className="flex justify-between items-center mb-2">
                <p className="text-white text-xs font-semibold">Progresso do mês</p>
                <p className="text-brand-green text-xs font-bold">{pct}% pago</p>
              </div>
              <div className="h-2.5 bg-brand-muted rounded-full overflow-hidden">
                <div className="h-full bg-brand-green rounded-full transition-all duration-500" style={{ width:`${pct}%` }}/>
              </div>
              <p className="text-gray-500 text-xs mt-1.5">{paidCount} de {bills.length} contas pagas</p>
            </div>
          )}

          {/* Filtros + botão adicionar */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5 flex-1">
              {(["all","pending","paid"] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${filter===f?"bg-brand-green text-brand-dark":"bg-brand-muted text-gray-400 border border-brand-border"}`}>
                  {f==="all"?"Todas":f==="pending"?"Pendentes":"Pagas"}
                </button>
              ))}
            </div>
            <button onClick={() => setShowForm(!showForm)}
              className="w-9 h-9 bg-brand-green rounded-xl flex items-center justify-center shrink-0">
              <Plus size={18} color="#0A0F1E" strokeWidth={2.5}/>
            </button>
          </div>

          {/* Formulário nova conta */}
          {showForm && (
            <div className="card space-y-3 border-brand-green/20">
              <p className="text-white font-semibold text-sm">Nova conta fixa</p>
              <div>
                <p className="text-gray-400 text-xs mb-2">Ícone</p>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map(ic => (
                    <button key={ic} onClick={() => setIcon(ic)}
                      className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all
                        ${icon===ic?"bg-brand-green/20 border-2 border-brand-green":"bg-brand-muted"}`}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
              <input className="input-field" placeholder="Nome (ex: Aluguel, Internet)" value={name} onChange={e => setName(e.target.value)}/>
              <input className="input-field" type="text" inputMode="numeric" placeholder="0,00" value={amount} onChange={e => setAmount(maskBRL(e.target.value))}/>
              <div>
                <p className="text-gray-400 text-xs mb-1 ml-1">Dia do vencimento</p>
                <input className="input-field" type="number" min="1" max="31" placeholder="Dia (1-31)" value={dueDay} onChange={e => setDueDay(e.target.value)}/>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary flex-1 text-sm" onClick={() => setShowForm(false)}>Cancelar</button>
                <button className="btn-primary flex-1 text-sm" onClick={addBill} disabled={saving}>{saving?"...":"Salvar"}</button>
              </div>
            </div>
          )}

          {/* Lista de contas */}
          {filtered.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-gray-500 text-sm">{bills.length===0?"Nenhuma conta cadastrada.":"Nenhuma conta nesse filtro."}</p>
              {bills.length===0 && <button onClick={() => setShowForm(true)} className="text-brand-green text-sm mt-1 inline-block">Adicionar primeira conta →</button>}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(bill => (
                <div key={bill.id} className={`card flex items-center gap-3 transition-all ${bill.isOverdue?"border-red-500/30 bg-red-500/5":bill.isToday?"border-yellow-500/30 bg-yellow-500/5":""} ${bill.isPaid?"opacity-70":""}`}>
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${bill.isPaid?"bg-brand-green/10":bill.isOverdue?"bg-red-500/10":bill.isToday?"bg-yellow-500/10":"bg-brand-muted"}`}>
                    {bill.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${bill.isPaid?"line-through text-gray-400":"text-white"}`}>{bill.name}</p>
                    <p className={`text-xs ${bill.isPaid?"text-brand-green":bill.isOverdue?"text-red-400":bill.isToday?"text-yellow-400":"text-gray-400"}`}>
                      {bill.isPaid ? "✓ Pago" : bill.isOverdue ? `Venceu dia ${bill.due_day}` : bill.isToday ? "Vence hoje!" : `Vence dia ${bill.due_day}`}
                    </p>
                  </div>
                  <p className={`font-bold text-sm shrink-0 ${bill.isPaid?"text-gray-400":bill.isOverdue?"text-red-400":bill.isToday?"text-yellow-400":"text-white"}`}>
                    {fmt(bill.amount)}
                  </p>
                  <button
                    onClick={() => setConfirm({ bill, action: bill.isPaid ? "unpay" : "pay" })}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${bill.isPaid?"bg-brand-green/20":bill.isOverdue?"bg-red-500/10 border border-red-500/30":bill.isToday?"bg-yellow-500/10 border border-yellow-500/30":"bg-brand-muted border border-brand-border"}`}>
                    {bill.isPaid ? <Check size={16} className="text-brand-green"/> : bill.isOverdue ? <AlertTriangle size={14} className="text-red-400"/> : bill.isToday ? <AlertTriangle size={14} className="text-yellow-400"/> : <div className="w-3 h-3 rounded-full border-2 border-gray-600"/>}
                  </button>
                  <button onClick={() => setConfirm({ bill, action: "delete" })} className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center">
                    <Trash2 size={13} className="text-red-400"/>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de confirmação */}
      {confirm && confirmContent && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setConfirm(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"/>
          <div className="relative w-full max-w-md mx-auto bg-[#111827] border-t border-brand-border rounded-t-3xl p-6 space-y-4"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-brand-border rounded-full mx-auto"/>
            <div className="flex items-start gap-3">
              <span className="text-2xl">{confirmContent.icon}</span>
              <div>
                <p className="text-white font-bold text-base">{confirmContent.title}</p>
                <p className="text-gray-400 text-sm mt-1">{confirmContent.desc}</p>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button className="btn-secondary flex-1 text-sm" onClick={() => setConfirm(null)}>
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={saving}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 ${confirmContent.danger ? "bg-red-500 text-white" : "btn-primary"}`}>
                {saving ? "..." : confirmContent.btnLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardWrapper>
  );
}
