"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import DashboardWrapper from "@/components/DashboardWrapper";

export default function ConfigPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      setUser(user);
      setLoading(false);
    }
    load();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
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

          <div className="card flex items-center gap-4">
            <div className="w-14 h-14 bg-brand-green rounded-2xl flex items-center justify-center text-brand-dark font-bold text-lg shrink-0">
              {initials}
            </div>
            <div>
              <p className="font-bold text-white">{userName}</p>
              <p className="text-gray-400 text-sm">{user?.email}</p>
            </div>
          </div>

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
