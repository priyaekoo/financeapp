"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Target, Settings } from "lucide-react";
import Link from "next/link";
import DashboardWrapper from "@/components/DashboardWrapper";

type Goal = { id: string; name: string; icon: string; target_amount: number; saved_amount: number; color: string; };

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format(v);
function maskBRL(v: string) {
  const digits = v.replace(/\D/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseInt(digits) / 100);
}
function parseBRL(v: string) {
  return parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;
}
const ICONS = ["✈️","📱","🏠","🚗","🎓","💍","🎮","🏖️","💪","🎯","🛒","👶"];
const COLORS = [
  { label:"Verde", value:"#00C896" },
  { label:"Roxo", value:"#9D7FEA" },
  { label:"Laranja", value:"#FF6B35" },
  { label:"Azul", value:"#3B82F6" },
  { label:"Rosa", value:"#EC4899" },
];

export default function ReservasPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [depositGoal, setDepositGoal] = useState<Goal | null>(null);
  const [depositAmt, setDepositAmt] = useState("");
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🎯");
  const [target, setTarget] = useState("");
  const [color, setColor] = useState("#00C896");
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      const { data } = await supabase.from("goals").select("*").eq("user_id", user?.id).order("created_at");
      setGoals(data || []);
      setLoading(false);
    }
    load();
  }, []);

  async function addGoal() {
    if (!name || !target) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("goals").insert({
      user_id: user?.id, name, icon,
      target_amount: parseBRL(target),
      saved_amount: 0, color,
    }).select().single();
    if (!error && data) {
      setGoals(prev => [...prev, data]);
      setName(""); setIcon("🎯"); setTarget(""); setColor("#00C896"); setShowForm(false);
    }
    setSaving(false);
  }

  async function deposit(goal: Goal) {
    if (!depositAmt) return;
    setSaving(true);
    const newSaved = Math.min(goal.saved_amount + parseBRL(depositAmt), goal.target_amount);
    await supabase.from("goals").update({ saved_amount: newSaved }).eq("id", goal.id);
    setGoals(prev => prev.map(g => g.id===goal.id ? { ...g, saved_amount: newSaved } : g));
    setDepositGoal(null); setDepositAmt(""); setSaving(false);
  }

  async function deleteGoal(id: string) {
    await supabase.from("goals").delete().eq("id", id);
    setGoals(prev => prev.filter(g => g.id !== id));
  }

  const totalAplicado = goals.reduce((s,g) => s+g.saved_amount, 0);

  return (
    <DashboardWrapper>
      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin"/></div>
      ) : (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Reservas</h1>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowForm(!showForm)} className="w-9 h-9 bg-brand-green rounded-xl flex items-center justify-center">
                <Plus size={18} color="#0A0F1E" strokeWidth={2.5}/>
              </button>
              <Link href="/config" className="w-9 h-9 bg-brand-muted rounded-xl flex items-center justify-center">
                <Settings size={17} className="text-gray-400"/>
              </Link>
            </div>
          </div>

          {/* Resumo */}
          {goals.length > 0 && (
            <div className="rounded-2xl p-4" style={{ background:"linear-gradient(135deg,#9D7FEA 0%,#7C5CE6 100%)" }}>
              <p className="text-purple-200 text-xs font-medium mb-1">Total aplicado</p>
              <p className="text-white text-3xl font-bold tracking-tight">{fmt(totalAplicado)}</p>
              <p className="text-purple-200 text-xs mt-2">{goals.length} reserva{goals.length>1?"s":""} ativa{goals.length>1?"s":""}</p>
            </div>
          )}

          {/* Formulário nova reserva */}
          {showForm && (
            <div className="card space-y-3 border-brand-green/20">
              <p className="text-white font-semibold text-sm">Nova reserva</p>
              <div>
                <p className="text-gray-400 text-xs mb-2">Ícone</p>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map(ic => (
                    <button key={ic} onClick={() => setIcon(ic)}
                      className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center ${icon===ic?"bg-brand-green/20 border-2 border-brand-green":"bg-brand-muted"}`}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
              <input className="input-field" placeholder="Nome (ex: Viagem, Celular)" value={name} onChange={e => setName(e.target.value)}/>
              <input className="input-field" type="text" inputMode="numeric" placeholder="0,00" value={target} onChange={e => setTarget(maskBRL(e.target.value))}/>
              <div>
                <p className="text-gray-400 text-xs mb-2">Cor</p>
                <div className="flex gap-2">
                  {COLORS.map(c => (
                    <button key={c.value} onClick={() => setColor(c.value)}
                      className={`w-8 h-8 rounded-full transition-all ${color===c.value?"ring-2 ring-white ring-offset-2 ring-offset-brand-dark":""}`}
                      style={{ background: c.value }}/>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary flex-1 text-sm" onClick={() => setShowForm(false)}>Cancelar</button>
                <button className="btn-primary flex-1 text-sm" onClick={addGoal} disabled={saving}>{saving?"...":"Salvar"}</button>
              </div>
            </div>
          )}

          {/* Modal depósito */}
          {depositGoal && (
            <div className="card space-y-3 border-brand-green/30">
              <p className="text-white font-semibold text-sm">Depositar em: {depositGoal.name}</p>
              <p className="text-gray-400 text-xs">Aplicado: {fmt(depositGoal.saved_amount)} / Meta: {fmt(depositGoal.target_amount)}</p>
              <input className="input-field" type="text" inputMode="numeric" placeholder="0,00"
                value={depositAmt} onChange={e => setDepositAmt(maskBRL(e.target.value))}/>
              <div className="flex gap-2">
                <button className="btn-secondary flex-1 text-sm" onClick={() => { setDepositGoal(null); setDepositAmt(""); }}>Cancelar</button>
                <button className="btn-primary flex-1 text-sm" onClick={() => deposit(depositGoal)} disabled={saving}>{saving?"...":"Depositar"}</button>
              </div>
            </div>
          )}

          {/* Lista */}
          {goals.length === 0 && !showForm ? (
            <div className="card text-center py-10">
              <Target size={32} className="text-gray-600 mx-auto mb-3"/>
              <p className="text-gray-500 text-sm">Nenhuma reserva criada.</p>
              <button onClick={() => setShowForm(true)} className="text-brand-green text-sm mt-1 inline-block">Criar primeira reserva →</button>
            </div>
          ) : (
            <div className="space-y-3">
              {goals.map(goal => {
                const pct = goal.target_amount > 0 ? Math.min((goal.saved_amount / goal.target_amount) * 100, 100) : 0;
                const done = pct >= 100;
                return (
                  <div key={goal.id} className={`card ${done?"border-brand-green/30":""}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: goal.color + "20" }}>
                        {goal.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm">{goal.name}</p>
                        <p className="text-xs font-bold" style={{ color: goal.color }}>{Math.round(pct)}% {done?"✓ Concluído!":"aplicado"}</p>
                      </div>
                      <button onClick={() => setDepositGoal(goal)}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-brand-border text-gray-400 active:scale-95 transition-all">
                        + Depositar
                      </button>
                      <button onClick={() => deleteGoal(goal.id)} className="w-7 h-7 bg-red-500/10 rounded-lg flex items-center justify-center">
                        <Trash2 size={12} className="text-red-400"/>
                      </button>
                    </div>
                    <div className="h-2.5 bg-brand-muted rounded-full overflow-hidden mb-2">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width:`${pct}%`, background: goal.color }}/>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Aplicado: <span className="text-white font-semibold">{fmt(goal.saved_amount)}</span></span>
                      <span className="text-gray-500">Meta: <span className="text-white font-semibold">{fmt(goal.target_amount)}</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </DashboardWrapper>
  );
}
