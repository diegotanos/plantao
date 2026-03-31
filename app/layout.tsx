import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PlantãoApp — Gestão de Plantões Médicos',
  description: 'Gestão inteligente de plantões e passagem digital para médicos',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-slate-900 text-white antialiased">{children}</body>
    </html>
  )
}
