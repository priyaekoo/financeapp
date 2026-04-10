"use client";
import BottomNav from "@/components/BottomNav";

export default function DashboardWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen max-w-md mx-auto relative">
      <main className="pb-28 px-4 pt-6">{children}</main>
      <BottomNav />
    </div>
  );
}
