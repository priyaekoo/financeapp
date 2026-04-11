"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogOut, Plus, Trash2, Target } from "lucide-react";
import DashboardWrapper from "@/components/DashboardWrapper";

type Goal = { id: string; name: string; icon: string; target_amount: number; saved_amount: number; color: string; };

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format(v);
const ICONS = ["✈️","📱","🏠","🚗","🎓","💍","🎮","🏖️","💪","🎯","🛒","👶"];
const COLORS = [
  { label:"Verde", value:"#00C896" },
  { label:"Roxo", value:"#9D7FEA" },
  { label:"Laranja", value:"#FF6B35" },
  { label:"Azul", value:"#3B82F6" },
  { label:"Rosa", value:"#EC4899" },
];

export default function ConfigPage() {
  const [user, setUser] = useState<any>(null);
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
      setUser(user);
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
      target_amount: parseFloat(target.replace(",",".")),
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
    const newSaved = Math.min(goal.saved_amount + parseFloat(depositAmt.replace(",",".")), goal.target_amount);
    await supabase.from("goals").update({ saved_amount: newSaved }).eq("id", goal.id);
    setGoals(prev => prev.map(g => g.id===goal.id ? { ...g, saved_amount: newSaved } : g));
    setDepositGoal(null); setDepositAmt(""); setSaving(false);
  }

  async function deleteGoal(id: string) {
    await supabase.from("goals").delete().eq("id", id);
    setGoals(prev => prev.filter(g => g.id !== id));
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const totalSaved = goals.reduce((s,g) => s+g.saved_amount, 0);
  const userName = user?.user_metadata?.name || "Usuário";
  const initials = userName.split(" ").map((n: string) => n[0]).slice(0,2).join("").toUpperCase();

  return (
    <DashboardWrapper>
      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin"/></div>
      ) : (
        <div className="space-y-5">
          <h1 className="text-xl font-bold">Configurações</h1>

          {/* Perfil */}
          <div className="card flex items-center gap-4">
            <div className="w-14 h-14 bg-brand-green rounded-2xl flex items-center justify-center text-brand-dark font-bold text-lg shrink-0">
              {initials}
            </div>
            <div>
              <p className="font-bold text-white">{userName}</p>
              <p className="text-gray-400 text-sm">{user?.email}</p>
            </div>
          </div>

          {/* Reservas / Metas */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-bold text-white">Reservas e Metas</h2>
                {goals.length > 0 && <p className="text-gray-500 text-xs mt-0.5">Total guardado: <span className="text-brand-green font-semibold">{fmt(totalSaved)}</span></p>}
              </div>
              <button onClick={() => setShowForm(!showForm)} className="w-9 h-9 bg-brand-green rounded-xl flex items-center justify-center">
                <Plus size={18} color="#0A0F1E" strokeWidth={2.5}/>
              </button>
            </div>

            {/* Formulário nova meta */}
            {showForm && (
              <div className="card mb-3 space-y-3">
                <p className="text-white font-semibold text-sm">Nova meta</p>
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
                <input className="input-field" placeholder="Nome da meta (ex: Viagem, Celular)" value={name} onChange={e => setName(e.target.value)}/>
                <input className="input-field" type="number" inputMode="decimal" placeholder="Valor alvo (R$)" value={target} onChange={e => setTarget(e.target.value)}/>
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
              <div className="card mb-3 space-y-3 border-brand-green/30">
                <p className="text-white font-semibold text-sm">Depositar em: {depositGoal.name}</p>
                <p className="text-gray-400 text-xs">Saldo atual: {fmt(depositGoal.saved_amount)} / {fmt(depositGoal.target_amount)}</p>
                <input className="input-field" type="number" inputMode="decimal" placeholder="Valor a depositar (R$)"
                  value={depositAmt} onChange={e => setDepositAmt(e.target.value)}/>
                <div className="flex gap-2">
                  <button className="btn-secondary flex-1 text-sm" onClick={() => { setDepositGoal(null); setDepositAmt(""); }}>Cancelar</button>
                  <button className="btn-primary flex-1 text-sm" onClick={() => deposit(depositGoal)} disabled={saving}>{saving?"...":"Depositar"}</button>
                </div>
              </div>
            )}

            {goals.length === 0 && !showForm ? (
              <div className="card text-center py-6">
                <Target size={28} className="text-gray-600 mx-auto mb-2"/>
                <p className="text-gray-500 text-sm">Nenhuma meta cadastrada.</p>
                <button onClick={() => setShowForm(true)} className="text-brand-green text-sm mt-1 inline-block">Criar primeira meta →</button>
              </div>
            ) : (
              <div className="space-y-2">
                {goals.map(goal => {
                  const pct = goal.target_amount > 0 ? Math.min((goal.saved_amount / goal.target_amount) * 100, 100) : 0;
                  const done = pct >= 100;
                  return (
                    <div key={goal.id} className={`card ${done?"border-brand-green/30":""}`}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: goal.color + "20" }}>
                          {goal.icon}
                        </div>
                        <div className="flex-1">
                          <p className="text-white font-semibold text-sm">{goal.name}</p>
                          <p className="text-xs font-bold" style={{ color: goal.color }}>{Math.round(pct)}% {done?"✓ Concluído!":""}</p>
                        </div>
                        <button onClick={() => setDepositGoal(goal)}
                          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-brand-border text-gray-400">
                          + Depositar
                        </button>
                        <button onClick={() => deleteGoal(goal.id)} className="w-7 h-7 bg-red-500/10 rounded-lg flex items-center justify-center">
                          <Trash2 size={12} className="text-red-400"/>
                        </button>
                      </div>
                      <div className="h-2.5 bg-brand-muted rounded-full overflow-hidden mb-1.5">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width:`${pct}%`, background: goal.color }}/>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Guardado: <span className="text-white font-semibold">{fmt(goal.saved_amount)}</span></span>
                        <span className="text-gray-500">Meta: <span className="text-white font-semibold">{fmt(goal.target_amount)}</span></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Logout */}
          <button onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-semibold active:scale-95 transition-all">
            <LogOut size={17}/>Sair da conta
          </button>
          <p className="text-center text-gray-600 text-xs pb-1">FinanceApp v3.0</p>
        </div>
      )}
    </DashboardWrapper>
  );
}
