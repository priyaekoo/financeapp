"use client";
import { useState, Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import DashboardWrapper from "@/components/DashboardWrapper";

const incomeCategories = ["Trabalho", "Freelance", "Investimento", "Outros"];
const expenseCategories = [
  "Alimentação",
  "Transporte",
  "Saúde",
  "Lazer",
  "Educação",
  "Moradia",
  "Roupas",
  "Gasolina",
  "Outros",
];

function maskBRL(v: string) {
  const digits = v.replace(/\D/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parseInt(digits) / 100);
}
function parseBRL(v: string) {
  return parseFloat(v.replace(/\./g, "").replace(",", ".")) || 0;
}

function AddForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [type, setType] = useState<"income" | "expense">(
    (params.get("type") as any) || "expense",
  );
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace("/login");
    });
  }, []);

  async function handleSave() {
    if (!description || !amount || !category) {
      setError("Preencha todos os campos.");
      return;
    }
    setLoading(true);
    setError("");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("transactions").insert({
      user_id: user?.id,
      type,
      description,
      category,
      amount: parseBRL(amount),
      date,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push("/");
  }

  const cats = type === "income" ? incomeCategories : expenseCategories;

  return (
    <DashboardWrapper>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-10 h-10 bg-brand-muted rounded-xl flex items-center justify-center"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-xl font-bold">Nova transação</h1>
        </div>

        <div className="flex gap-2 bg-brand-muted p-1 rounded-2xl">
          {(["income", "expense"] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setType(t);
                setCategory("");
              }}
              className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all
                ${type === t ? (t === "income" ? "bg-brand-green text-brand-dark" : "bg-brand-orange text-white") : "text-gray-400"}`}
            >
              {t === "income" ? "Entrada" : "Saída"}
            </button>
          ))}
        </div>

        <div className="card text-center py-5">
          <p className="text-gray-400 text-xs mb-2">Valor</p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-gray-400 text-xl font-bold">R$</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0,00"
              className="text-4xl font-bold bg-transparent text-white text-center w-44 focus:outline-none placeholder-gray-600"
              value={amount}
              onChange={(e) => setAmount(maskBRL(e.target.value))}
            />
          </div>
        </div>

        <div className="space-y-3">
          <input
            className="input-field"
            placeholder="Descrição (ex: Mercado, Salário...)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div>
            <p className="text-gray-400 text-xs mb-2 ml-1">Categoria</p>
            <div className="flex flex-wrap gap-2">
              {cats.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium transition-all
                    ${category === cat ? (type === "income" ? "bg-brand-green text-brand-dark" : "bg-brand-orange text-white") : "bg-brand-muted text-gray-400 border border-brand-border"}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-gray-400 text-xs mb-1 ml-1">Data</p>
            <input
              className="input-field"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          className="btn-primary w-full"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? "Salvando..." : "Salvar transação"}
        </button>
      </div>
    </DashboardWrapper>
  );
}

export default function AdicionarPage() {
  return (
    <Suspense
      fallback={
        <DashboardWrapper>
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
          </div>
        </DashboardWrapper>
      }
    >
      <AddForm />
    </Suspense>
  );
}
