'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Paciente } from '@/lib/types'
import Link from 'next/link'

const STATUS_CONFIG = {
  estavel: { label: 'Estável', badge: 'bg-green-500/20 text-green-400', emoji: '🟢' },
  atencao: { label: 'Atenção', badge: 'bg-yellow-500/20 text-yellow-400', emoji: '🟡' },
  critico: { label: 'Crítico', badge: 'bg-red-500/20 text-red-400', emoji: '🔴' },
}

export default function PacientesPage() {
  const supabase = createClient()
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')

  useEffect(() => {
    const fetchPacientes = async () => {
      const { data } = await supabase
        .from('pacientes')
        .select('*, pendencias(*)')
        .order('status')
        .order('leito')
      setPacientes(data || [])
      setLoading(false)
    }
    fetchPacientes()
  }, [supabase])

  const filtrados = filtroStatus === 'todos'
    ? pacientes
    : pacientes.filter(p => p.status === filtroStatus)

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Pacientes</h1>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {['todos', 'critico', 'atencao', 'estavel'].map(f => (
          <button
            key={f}
            onClick={() => setFiltroStatus(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filtroStatus === f
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {f === 'todos' ? 'Todos' : STATUS_CONFIG[f as keyof typeof STATUS_CONFIG].emoji + ' ' + STATUS_CONFIG[f as keyof typeof STATUS_CONFIG].label}
            {' '}({f === 'todos' ? pacientes.length : pacientes.filter(p => p.status === f).length})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-slate-400 text-center py-12">Carregando...</div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-5xl mb-4">🛏</p>
          <p>Nenhum paciente encontrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map(p => {
            const cfg = STATUS_CONFIG[p.status]
            const pendencias = (p.pendencias || []).filter(x => !x.concluida).length
            return (
              <Link key={p.id} href={`/plantao/${p.plantao_id}`}>
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 hover:border-slate-500 transition">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{cfg.emoji}</span>
                        <span className="text-white font-medium">Leito {p.leito}</span>
                        <span className="text-slate-400">—</span>
                        <span className="text-white">{p.nome}</span>
                        {p.idade && <span className="text-slate-400 text-sm">{p.idade}a</span>}
                      </div>
                      <p className="text-slate-400 text-sm mt-1">{p.diagnostico_principal}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {pendencias > 0 && (
                        <span className="bg-orange-500/20 text-orange-400 text-xs px-2 py-1 rounded-full">
                          {pendencias} pend.
                        </span>
                      )}
                      <span className={`px-2 py-1 rounded-full text-xs ${cfg.badge}`}>{cfg.label}</span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
