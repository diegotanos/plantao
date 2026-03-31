'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: '🏠' },
  { href: '/plantao', label: 'Plantões', icon: '📋' },
  { href: '/pacientes', label: 'Pacientes', icon: '🛏' },
  { href: '/intercorrencias', label: 'Intercorrências', icon: '⚠️' },
  { href: '/estatisticas', label: 'Estatísticas', icon: '📊' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex flex-col w-56 bg-slate-800/80 border-r border-slate-700 h-full">
      {/* Logo */}
      <div className="p-5 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏥</span>
          <div>
            <p className="text-white font-bold text-sm">PlantãoApp</p>
            <p className="text-slate-500 text-xs">Gestão de Plantões</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map(item => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-slate-700">
        <Link
          href="/plantao/novo"
          className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2.5 rounded-lg text-sm font-medium transition"
        >
          + Novo Plantão
        </Link>
      </div>
    </aside>
  )
}
