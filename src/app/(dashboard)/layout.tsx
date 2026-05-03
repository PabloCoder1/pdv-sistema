// src/app/(dashboard)/layout.tsx
import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar />
      {/* O main empurra o conteúdo para a direita, dando espaço para a sidebar fixa de 64 (16rem/256px) */}
      <main className="flex-1 ml-64 p-8">
        {children}
      </main>
    </div>
  );
}