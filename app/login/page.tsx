"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit() {
    setLoading(true);
    setError("");
    try {
      if (isRegister) {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
        if (error) throw error;
        setError("Verifique seu email para confirmar o cadastro!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/");
        router.refresh();
      }
    } catch (e: any) {
      setError(e.message || "Algo deu errado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="mb-10 text-center">
        <div className="w-16 h-16 bg-brand-green rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">💰</span>
        </div>
        <h1 className="text-2xl font-bold text-white">FinanceApp</h1>
        <p className="text-gray-400 text-sm mt-1">Seu controle financeiro pessoal</p>
      </div>

      <div className="w-full max-w-sm card space-y-4">
        <h2 className="text-lg font-bold text-white">{isRegister ? "Criar conta" : "Entrar"}</h2>
        {isRegister && (
          <input className="input-field" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} />
        )}
        <input className="input-field" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input-field" placeholder="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

        {error && (
          <p className={`text-sm ${error.includes("Verifique") ? "text-brand-green" : "text-red-400"}`}>{error}</p>
        )}

        <button className="btn-primary w-full" onClick={handleSubmit} disabled={loading}>
          {loading ? "Aguarde..." : isRegister ? "Criar conta" : "Entrar"}
        </button>

        <p className="text-center text-gray-400 text-sm">
          {isRegister ? "Já tem conta?" : "Não tem conta?"}{" "}
          <button className="text-brand-green font-semibold" onClick={() => { setIsRegister(!isRegister); setError(""); }}>
            {isRegister ? "Entrar" : "Criar conta"}
          </button>
        </p>
      </div>
    </div>
  );
}
