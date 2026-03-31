'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Intercorrencia } from '@/lib/types'
import { formatarData } from '@/lib/utils/formatters'

const GRAVIDADE_CONFIG = {
  leve: { label: 'Leve', class: 'bg-green-500/20 text-green-400 border-green-500/30' },
  moderada: { label: 'Moderada', class: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  grave: { label: 'Grave', class: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

export default function IntercorrenciasPage() {
  const supabase = createClient()
  const [intercorrencias, setIntercorrencias] = useState<Intercorrencia[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroGravidade, setFiltroGravidade] = useState<string>('todos')

  useEffect(() => {
    const fetchIntercorrencias = async () => {
      const { data } = await supabase
        .from('intercorrencias')
        .select('*, paciente:pacientes(nome,leito)')
        .order('horario', { ascending: false })
      setIntercorrencias(data || [])
      setLoading(false)
    }
    fetchIntercorrencias()
  }, [supabase])

  const filtradas = filtroGravidade === 'todos'
    ? intercorrencias
    : intercorrencias.filter(i => i.gravidade === filtroGravidade)

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Intercorrências</h1>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {['todos', 'grave', 'moderada', 'leve'].map(f => (
          <button
            key={f}
            onClick={() => setFiltroGravidade(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filtroGravidade === f
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {f === 'todos' ? 'Todas' : f.charAt(0).toUpperCase() + f.slice(1)}
            {' '}({f === 'todos' ? intercorrencias.length : intercorrencias.filter(i => i.gravidade === f).length})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-slate-400 text-center py-12">Carregando...</div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-5xl mb-4">📝</p>
          <p>Nenhuma intercorrência registrada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtradas.map(i => {
            const cfg = GRAVIDADE_CONFIG[i.gravidade]
            return (
              <div key={i.id} className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-white font-medium">
                      Leito {i.paciente?.leito} — {i.paciente?.nome}
                    </p>
                    <p className="text-slate-500 text-sm">{formatarData(i.horario)}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs border ${cfg.class}`}>
                    {cfg.label}
                  </span>
                </div>
                <p className="text-slate-300 text-sm">{i.descricao}</p>
                <p className="text-slate-400 text-sm mt-2">
                  <strong className="text-slate-300">Conduta:</strong> {i.conduta}
                </p>
                {i.resultado && (
                  <p className="text-slate-400 text-sm mt-1">
                    <strong className="text-slate-300">Resultado:</strong> {i.resultado}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
