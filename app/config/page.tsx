"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogOut, Lock, Calendar } from "lucide-react";
import DashboardWrapper from "@/components/DashboardWrapper";

export default function ConfigPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Redefinir senha
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: "ok"|"err"; text: string } | null>(null);

  // Ciclo de pagamento
  const [cycle, setCycle] = useState<"monthly"|"weekly">("monthly");
  const [cycleLoading, setCycleLoading] = useState(false);
  const [cycleSaved, setCycleSaved] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      setUser(user);
      setCycle(user.user_metadata?.payment_cycle || "monthly");
      setLoading(false);
    }
    load();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleChangePassword() {
    if (!newPassword || newPassword.length < 6) {
      setPwdMsg({ type:"err", text:"A senha deve ter pelo menos 6 caracteres." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdMsg({ type:"err", text:"As senhas não coincidem." });
      return;
    }
    setPwdLoading(true);
    setPwdMsg(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPwdMsg({ type:"err", text: error.message });
    } else {
      setPwdMsg({ type:"ok", text:"Senha alterada com sucesso!" });
      setNewPassword(""); setConfirmPassword(""); setShowPassword(false);
    }
    setPwdLoading(false);
  }

  async function handleSaveCycle(value: "monthly" | "weekly") {
    setCycle(value);
    setCycleLoading(true);
    setCycleSaved(false);
    await supabase.auth.updateUser({ data: { payment_cycle: value } });
    setCycleLoading(false);
    setCycleSaved(true);
    setTimeout(() => setCycleSaved(false), 2000);
  }

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

          {/* Ciclo de recebimento */}
          <div className="card space-y-3">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-brand-green"/>
              <p className="text-white font-semibold text-sm">Ciclo de recebimento</p>
            </div>
            <div className="flex gap-2">
              {(["monthly","weekly"] as const).map(opt => (
                <button
                  key={opt}
                  onClick={() => handleSaveCycle(opt)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${cycle===opt ? "bg-brand-green text-brand-dark" : "bg-brand-muted text-gray-400 border border-brand-border"}`}
                >
                  {opt === "monthly" ? "📅 Mensal" : "📆 Semanal"}
                </button>
              ))}
            </div>
            {cycleLoading && <p className="text-gray-400 text-xs">Salvando...</p>}
            {cycleSaved && <p className="text-brand-green text-xs">✓ Preferência salva!</p>}
            <p className="text-gray-500 text-xs">
              {cycle === "weekly"
                ? "Visão semanal ativada na aba Contas — filtra suas contas pela semana atual."
                : "Visão mensal padrão na aba Contas."}
            </p>
          </div>

          {/* Redefinir senha */}
          <div className="card space-y-3">
            <button
              onClick={() => { setShowPassword(!showPassword); setPwdMsg(null); }}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Lock size={16} className="text-brand-green"/>
                <p className="text-white font-semibold text-sm">Redefinir senha</p>
              </div>
              <span className="text-gray-500 text-xs">{showPassword ? "▲ Fechar" : "▼ Abrir"}</span>
            </button>

            {showPassword && (
              <div className="space-y-3 pt-1">
                <input
                  className="input-field"
                  type="password"
                  placeholder="Nova senha (mín. 6 caracteres)"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                />
                <input
                  className="input-field"
                  type="password"
                  placeholder="Confirmar nova senha"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                />
                {pwdMsg && (
                  <p className={`text-xs ${pwdMsg.type === "ok" ? "text-brand-green" : "text-red-400"}`}>
                    {pwdMsg.type === "ok" ? "✓ " : "✗ "}{pwdMsg.text}
                  </p>
                )}
                <button
                  onClick={handleChangePassword}
                  disabled={pwdLoading}
                  className="btn-primary w-full text-sm"
                >
                  {pwdLoading ? "Salvando..." : "Alterar senha"}
                </button>
              </div>
            )}
          </div>

          {/* Logout */}
          <button onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-semibold active:scale-95 transition-all">
            <LogOut size={17}/>Sair da conta
          </button>

          <p className="text-center text-gray-600 text-xs pb-1">FinanceApp v4.0</p>
        </div>
      )}
    </DashboardWrapper>
  );
}
