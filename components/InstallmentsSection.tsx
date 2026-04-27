"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, ChevronDown, ChevronUp, CreditCard } from "lucide-react";

type Installment = {
  id: string;
  card_name: string;
  purchase_name: string;
  total_amount: number;
  installment_count: number;
  start_month: number;
  start_year: number;
};

const MONTHS_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
function maskBRL(v: string) {
  const digits = v.replace(/\D/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseInt(digits) / 100);
}
function parseBRL(v: string) {
  return parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;
}

function calcInst(inst: Installment, now: Date) {
  const monthsElapsed = (now.getFullYear() - inst.start_year) * 12 + (now.getMonth() - (inst.start_month - 1));
  const paid = Math.max(0, Math.min(monthsElapsed + 1, inst.installment_count));
  return { paid, remaining: inst.installment_count - paid };
}

function getProjection(cardInsts: Installment[], fromDate: Date) {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(fromDate.getFullYear(), fromDate.getMonth() + i, 1);
    const absMonth = d.getFullYear() * 12 + d.getMonth();
    const total = cardInsts.reduce((sum, inst) => {
      const startAbs = inst.start_year * 12 + (inst.start_month - 1);
      const endAbs = startAbs + inst.installment_count;
      return absMonth >= startAbs && absMonth < endAbs
        ? sum + inst.total_amount / inst.installment_count
        : sum;
    }, 0);
    return { label: `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`, total, isFirst: i === 0 };
  });
}

export default function InstallmentsSection() {
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [cardTabs, setCardTabs] = useState<Record<string, "compras" | "projecao">>({});
  const [showModal, setShowModal] = useState(false);
  const [formCard, setFormCard] = useState("");
  const [formPurchase, setFormPurchase] = useState("");
  const [formTotal, setFormTotal] = useState("");
  const [formCount, setFormCount] = useState("12");
  const [formStartMonth, setFormStartMonth] = useState(new Date().getMonth() + 1);
  const [formStartYear, setFormStartYear] = useState(new Date().getFullYear());
  const [formSaving, setFormSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Installment | null>(null);

  const supabase = createClient();
  const now = new Date();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("installments").select("*").eq("user_id", user.id).order("created_at");
      setInstallments(data || []);
      setLoading(false);
    }
    load();
  }, []);

  async function saveInstallment() {
    if (!formCard.trim() || !formPurchase.trim() || !formTotal || !formCount) return;
    setFormSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("installments").insert({
      user_id: user?.id,
      card_name: formCard.trim(),
      purchase_name: formPurchase.trim(),
      total_amount: parseBRL(formTotal),
      installment_count: parseInt(formCount),
      start_month: formStartMonth,
      start_year: formStartYear,
    }).select().single();
    if (!error && data) {
      setInstallments(prev => [...prev, data]);
      setExpandedCard(data.card_name);
      setShowModal(false);
      setFormCard(""); setFormPurchase(""); setFormTotal(""); setFormCount("12");
      setFormStartMonth(new Date().getMonth() + 1); setFormStartYear(new Date().getFullYear());
    }
    setFormSaving(false);
  }

  async function removeInstallment(id: string) {
    await supabase.from("installments").delete().eq("id", id);
    setInstallments(prev => prev.filter(i => i.id !== id));
    setDeleteConfirm(null);
  }

  function openModal() {
    setFormCard(""); setFormPurchase(""); setFormTotal(""); setFormCount("12");
    setFormStartMonth(new Date().getMonth() + 1); setFormStartYear(new Date().getFullYear());
    setShowModal(true);
  }

  // Agrupa por cartão mantendo a ordem de inserção
  const cardNames = installments.map(i => i.card_name).filter((c, idx, arr) => arr.indexOf(c) === idx);
  const cardGroups: Record<string, Installment[]> = {};
  for (const inst of installments) {
    if (!cardGroups[inst.card_name]) cardGroups[inst.card_name] = [];
    cardGroups[inst.card_name].push(inst);
  }

  // Métricas globais
  const allActive = installments.filter(i => calcInst(i, now).remaining > 0);
  const totalMonthly = allActive.reduce((s, i) => s + i.total_amount / i.installment_count, 0);
  const totalRemaining = allActive.reduce((s, i) => {
    const { remaining } = calcInst(i, now);
    return s + remaining * (i.total_amount / i.installment_count);
  }, 0);

  const existingCards = cardNames; // já dedupado via Set acima
  const formMonthly = parseInt(formCount) > 0 && parseBRL(formTotal) > 0
    ? parseBRL(formTotal) / parseInt(formCount)
    : 0;

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard size={17} className="text-gray-400"/>
          <h2 className="text-white font-bold text-base">Parcelamentos</h2>
        </div>
        <button onClick={openModal}
          className="flex items-center gap-1.5 px-3 py-2 bg-brand-green rounded-xl text-brand-dark font-semibold text-xs active:scale-95 transition-all">
          <Plus size={13} strokeWidth={2.5}/> Nova compra
        </button>
      </div>

      {/* Resumo global */}
      {allActive.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="card p-3">
            <p className="text-gray-400 text-[10px] mb-1">Mensal total</p>
            <p className="text-brand-orange font-bold text-sm">{fmt(totalMonthly)}</p>
          </div>
          <div className="card p-3">
            <p className="text-gray-400 text-[10px] mb-1">Compras ativas</p>
            <p className="text-white font-bold text-sm">{allActive.length}</p>
          </div>
          <div className="card p-3">
            <p className="text-gray-400 text-[10px] mb-1">Total restante</p>
            <p className="text-red-400 font-bold text-sm">{fmt(totalRemaining)}</p>
          </div>
        </div>
      )}

      {/* Acordeão por cartão */}
      {cardNames.length === 0 ? (
        <div className="card text-center py-8">
          <CreditCard size={28} className="text-gray-600 mx-auto mb-2"/>
          <p className="text-gray-500 text-sm">Nenhum parcelamento cadastrado.</p>
          <button onClick={openModal} className="text-brand-green text-sm mt-1 inline-block">Adicionar primeiro →</button>
        </div>
      ) : (
        <div className="space-y-2">
          {cardNames.map(cardName => {
            const insts = cardGroups[cardName];
            const activeInsts = insts.filter(i => calcInst(i, now).remaining > 0);
            const cardMonthly = activeInsts.reduce((s, i) => s + i.total_amount / i.installment_count, 0);
            const isExpanded = expandedCard === cardName;
            const activeTab = cardTabs[cardName] || "compras";
            const projection = getProjection(insts, now);

            return (
              <div key={cardName} className="card p-0 overflow-hidden">
                {/* Cabeçalho do cartão */}
                <button
                  onClick={() => setExpandedCard(isExpanded ? null : cardName)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 active:opacity-70 transition-opacity">
                  <div className="w-10 h-10 rounded-xl bg-brand-muted flex items-center justify-center shrink-0">
                    <CreditCard size={17} className={activeInsts.length > 0 ? "text-brand-orange" : "text-gray-500"}/>
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-white font-semibold text-sm">{cardName}</p>
                    <p className="text-gray-400 text-xs">
                      {activeInsts.length} compra{activeInsts.length !== 1 ? "s" : ""} ativa{activeInsts.length !== 1 ? "s" : ""}
                      {activeInsts.length > 0 && ` · ${fmt(cardMonthly)}/mês`}
                    </p>
                  </div>
                  {isExpanded
                    ? <ChevronUp size={16} className="text-gray-400 shrink-0"/>
                    : <ChevronDown size={16} className="text-gray-400 shrink-0"/>}
                </button>

                {/* Conteúdo expandido */}
                {isExpanded && (
                  <div className="border-t border-brand-border">
                    {/* Tabs */}
                    <div className="flex gap-1 px-4 pt-3 pb-2">
                      {(["compras", "projecao"] as const).map(tab => (
                        <button key={tab}
                          onClick={() => setCardTabs(prev => ({ ...prev, [cardName]: tab }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === tab ? "bg-brand-green text-brand-dark" : "text-gray-400"}`}>
                          {tab === "compras" ? "Compras" : "Projeção"}
                        </button>
                      ))}
                    </div>

                    {/* Aba: Compras */}
                    {activeTab === "compras" && (
                      <div className="px-4 pb-4 space-y-2">
                        {insts.map(inst => {
                          const { paid, remaining } = calcInst(inst, now);
                          const monthly = inst.total_amount / inst.installment_count;
                          const remainingValue = remaining * monthly;
                          const pct = Math.round((paid / inst.installment_count) * 100);
                          const done = remaining <= 0;
                          const isLast = remaining === 1;
                          return (
                            <div key={inst.id} className={`bg-brand-muted rounded-xl p-3 ${done ? "opacity-50" : ""}`}>
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-white font-semibold text-sm">{inst.purchase_name}</p>
                                    {isLast && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">última</span>
                                    )}
                                    {done && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand-green/15 text-brand-green">quitada</span>
                                    )}
                                  </div>
                                  <p className="text-gray-500 text-xs mt-0.5">{paid}/{inst.installment_count} parcelas</p>
                                </div>
                                <button onClick={() => setDeleteConfirm(inst)} className="w-7 h-7 bg-red-500/10 rounded-lg flex items-center justify-center shrink-0">
                                  <Trash2 size={12} className="text-red-400"/>
                                </button>
                              </div>
                              <div className="h-1.5 bg-brand-border rounded-full overflow-hidden mb-2">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${done ? "bg-brand-green" : isLast ? "bg-yellow-400" : "bg-brand-orange"}`}
                                  style={{ width: `${pct}%` }}/>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-400">
                                  {done ? "Concluído" : `Restam ${fmt(remainingValue)}`}
                                </span>
                                <span className={`font-semibold ${done ? "text-brand-green" : "text-white"}`}>
                                  {done ? fmt(inst.total_amount) : `${fmt(monthly)}/mês`}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Aba: Projeção */}
                    {activeTab === "projecao" && (
                      <div className="px-4 pb-4">
                        {projection.map(({ label, total, isFirst }, i) => (
                          <div key={i} className={`flex items-center justify-between py-2.5 ${i < 11 ? "border-b border-brand-border" : ""}`}>
                            <span className={`text-xs font-medium ${total === 0 ? "text-gray-600" : isFirst ? "text-brand-green" : "text-gray-300"}`}>
                              {label}{isFirst ? " · este mês" : ""}
                            </span>
                            <span className={`text-xs font-bold tabular-nums ${total === 0 ? "text-gray-600" : "text-brand-orange"}`}>
                              {total === 0 ? "—" : fmt(total)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal nova compra */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-end" onClick={() => setShowModal(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"/>
          <div
            className="relative w-full max-w-md mx-auto bg-[#111827] border-t border-brand-border rounded-t-3xl px-6 pt-5 pb-10 space-y-3 max-h-[92vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-brand-border rounded-full mx-auto"/>
            <p className="text-white font-bold text-base">Nova compra parcelada</p>

            {/* Sugestões de cartão */}
            {existingCards.length > 0 && (
              <div>
                <p className="text-gray-400 text-xs mb-2">Selecionar cartão</p>
                <div className="flex flex-wrap gap-2 mb-1">
                  {existingCards.map(c => (
                    <button key={c} onClick={() => setFormCard(c)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${formCard === c ? "bg-brand-green text-brand-dark" : "bg-brand-muted text-gray-300 border border-brand-border"}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <input
              className="input-field"
              placeholder={existingCards.length > 0 ? "Ou digite o nome de um cartão novo" : "Nome do cartão (ex: Nubank, Itaú)"}
              value={formCard}
              onChange={e => setFormCard(e.target.value)}/>
            <input
              className="input-field"
              placeholder="O que foi comprado (ex: TV Samsung)"
              value={formPurchase}
              onChange={e => setFormPurchase(e.target.value)}/>
            <input
              className="input-field"
              type="text" inputMode="numeric"
              placeholder="Valor total (ex: 1.200,00)"
              value={formTotal}
              onChange={e => setFormTotal(maskBRL(e.target.value))}/>
            <div>
              <p className="text-gray-400 text-xs mb-1 ml-1">Número de parcelas</p>
              <input
                className="input-field"
                type="number" min="1" max="120"
                placeholder="Ex: 12"
                value={formCount}
                onChange={e => setFormCount(e.target.value)}/>
            </div>

            {formMonthly > 0 && (
              <div className="bg-brand-muted rounded-xl px-3 py-2.5 flex justify-between items-center">
                <p className="text-gray-400 text-xs">Valor por parcela</p>
                <p className="text-brand-orange font-bold text-sm">{fmt(formMonthly)}/mês</p>
              </div>
            )}

            <div>
              <p className="text-gray-400 text-xs mb-1 ml-1">Mês da 1ª parcela</p>
              <div className="flex gap-2">
                <select
                  className="input-field flex-1"
                  value={formStartMonth}
                  onChange={e => setFormStartMonth(parseInt(e.target.value))}>
                  {MONTHS_PT.map((m, i) => (
                    <option key={i} value={i + 1} className="bg-brand-card">{m}</option>
                  ))}
                </select>
                <input
                  className="input-field w-24"
                  type="number" min="2020" max="2040"
                  value={formStartYear}
                  onChange={e => setFormStartYear(parseInt(e.target.value))}/>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                className="flex-1 py-3.5 rounded-xl font-semibold text-sm bg-brand-muted text-gray-300 border border-brand-border active:scale-95 transition-all"
                onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button
                onClick={saveInstallment}
                disabled={formSaving || !formCard.trim() || !formPurchase.trim() || !formTotal || !formCount}
                className="flex-1 py-3.5 rounded-xl font-semibold text-sm bg-brand-green text-brand-dark transition-all active:scale-95 disabled:opacity-50">
                {formSaving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar exclusão */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-end" onClick={() => setDeleteConfirm(null)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"/>
          <div
            className="relative w-full max-w-md mx-auto bg-[#111827] border-t border-brand-border rounded-t-3xl px-6 pt-5 pb-10 space-y-4"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-brand-border rounded-full mx-auto"/>
            <div className="flex items-start gap-3">
              <span className="text-2xl">🗑️</span>
              <div>
                <p className="text-white font-bold text-base">Remover parcelamento?</p>
                <p className="text-gray-400 text-sm mt-1 leading-relaxed">
                  "{deleteConfirm.purchase_name}" será removido do acompanhamento.
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                className="flex-1 py-3.5 rounded-xl font-semibold text-sm bg-brand-muted text-gray-300 border border-brand-border active:scale-95 transition-all"
                onClick={() => setDeleteConfirm(null)}>
                Cancelar
              </button>
              <button
                onClick={() => removeInstallment(deleteConfirm.id)}
                className="flex-1 py-3.5 rounded-xl font-semibold text-sm bg-red-500 text-white transition-all active:scale-95">
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
