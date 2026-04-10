"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BarChart2, PlusCircle, CreditCard, Settings } from "lucide-react";

const tabs = [
  { href: "/", icon: Home, label: "Início" },
  { href: "/relatorios", icon: BarChart2, label: "Relatórios" },
  { href: "/adicionar", icon: PlusCircle, label: "Adicionar", isAdd: true },
  { href: "/contas", icon: CreditCard, label: "Contas" },
  { href: "/config", icon: Settings, label: "Config" },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto bg-brand-card border-t border-brand-border flex items-center justify-around px-2"
         style={{ paddingBottom: "max(14px, env(safe-area-inset-bottom))", paddingTop: "10px" }}>
      {tabs.map(({ href, icon: Icon, label, isAdd }) => {
        const active = pathname === href;
        return (
          <Link key={href} href={href}
            className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all
              ${isAdd ? "relative -top-5 bg-brand-green rounded-2xl p-3 shadow-lg shadow-brand-green/30" : ""}
              ${active && !isAdd ? "text-brand-green" : !isAdd ? "text-gray-500" : ""}`}>
            <Icon
              size={isAdd ? 24 : 20}
              color={isAdd ? "#0A0F1E" : active ? "#00C896" : "#6B7280"}
              strokeWidth={active ? 2.5 : 1.8}
            />
            {!isAdd && <span className="text-[10px] font-medium">{label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
