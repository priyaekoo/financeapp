"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "financeapp_remember";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [remember, setRemember] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { email: e, password: p } = JSON.parse(saved);
        if (e) setEmail(e);
        if (p) setPassword(p);
        setRemember(true);
      }
    } catch {}
  }, []);

  async function handleSubmit() {
    setLoading(true);
    setError("");
    try {
      if (isRegister) {
        const { error: signUpError } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
        if (signUpError) throw signUpError;
        const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
        if (loginError) throw loginError;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      if (remember) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ email, password }));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      router.push("/");
      router.refresh();
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

        {!isRegister && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div onClick={() => setRemember(v => !v)}
              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${remember ? "bg-brand-green border-brand-green" : "border-gray-600 bg-transparent"}`}>
              {remember && <span className="text-brand-dark text-xs font-bold">✓</span>}
            </div>
            <span className="text-gray-400 text-sm">Lembrar email e senha</span>
          </label>
        )}

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
