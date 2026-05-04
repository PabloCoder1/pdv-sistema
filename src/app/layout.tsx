// src/app/layout.tsx
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from 'sonner';
import './globals.css'; 

export const metadata = {
  title: 'PDV Pro',
  description: 'Sistema de Gestão e PDV',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-slate-50 min-h-screen">
        {/* O AuthProvider DEVE envolver o children aqui na raiz */}
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}