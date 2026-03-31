'use client'
import { use, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Paciente } from '@/lib/types'
import { formatarData } from '@/lib/utils/formatters'
import Link from 'next/link'

export default function PacienteDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const supabase = createClient()
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPaciente = async () => {
      const { data } = await supabase
        .from('pacientes')
        .select('*, pendencias(*), intercorrencias(*)')
        .eq('id', id)
        .single()
      setPaciente(data)
      setLoading(false)
    }
    fetchPaciente()
  }, [id, supabase])

  if (loading) return <div className="p-6 text-slate-400">Carregando...</div>
  if (!paciente) return <div className="p-6 text-slate-400">Paciente não encontrado.</div>

  const statusConfig = {
    estavel: { label: 'Estável', class: 'bg-green-500/20 text-green-400' },
    atencao: { label: 'Atenção', class: 'bg-yellow-500/20 text-yellow-400' },
    critico: { label: 'Crítico', class: 'bg-red-500/20 text-red-400' },
  }
  const cfg = statusConfig[paciente.status]

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/pacientes" className="text-slate-400 hover:text-white transition">←</Link>
        <div>
          <h1 className="text-2xl font-bold text-white">{paciente.nome}</h1>
          <p className="text-slate-400 text-sm">Leito {paciente.leito}{paciente.idade ? ` · ${paciente.idade} anos` : ''}</p>
        </div>
        <span className={`ml-auto px-3 py-1 rounded-full text-sm ${cfg.class}`}>{cfg.label}</span>
      </div>

      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 space-y-3">
        <h2 className="text-white font-semibold">Diagnósticos</h2>
        <p className="text-slate-300">{paciente.diagnostico_principal}</p>
        {paciente.diagnosticos_secundarios?.map((d, i) => (
          <p key={i} className="text-slate-400 text-sm">• {d}</p>
        ))}
      </div>

      {(paciente.sbar_situacao || paciente.sbar_background || paciente.sbar_avaliacao || paciente.sbar_recomendacao) && (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 space-y-3">
          <h2 className="text-white font-semibold">SBAR</h2>
          {paciente.sbar_situacao && <p className="text-slate-300 text-sm"><strong className="text-slate-200">Situação:</strong> {paciente.sbar_situacao}</p>}
          {paciente.sbar_background && <p className="text-slate-300 text-sm"><strong className="text-slate-200">Background:</strong> {paciente.sbar_background}</p>}
          {paciente.sbar_avaliacao && <p className="text-slate-300 text-sm"><strong className="text-slate-200">Avaliação:</strong> {paciente.sbar_avaliacao}</p>}
          {paciente.sbar_recomendacao && <p className="text-slate-300 text-sm"><strong className="text-slate-200">Recomendação:</strong> {paciente.sbar_recomendacao}</p>}
        </div>
      )}

      {paciente.pendencias && paciente.pendencias.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 space-y-3">
          <h2 className="text-white font-semibold">Pendências</h2>
          {paciente.pendencias.map(pend => (
            <div key={pend.id} className="flex items-center gap-3">
              <span className={`w-4 h-4 rounded border-2 flex items-center justify-center text-xs ${pend.concluida ? 'border-green-500 bg-green-500/20 text-green-400' : 'border-slate-500'}`}>
                {pend.concluida ? '✓' : ''}
              </span>
              <span className={`text-sm flex-1 ${pend.concluida ? 'line-through text-slate-500' : 'text-slate-300'}`}>
                {pend.descricao}
              </span>
              <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded">{pend.tipo}</span>
            </div>
          ))}
        </div>
      )}

      {paciente.intercorrencias && paciente.intercorrencias.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 space-y-3">
          <h2 className="text-white font-semibold">Intercorrências</h2>
          {paciente.intercorrencias.map(i => (
            <div key={i.id} className="border-l-2 border-slate-600 pl-3 space-y-1">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${i.gravidade === 'grave' ? 'bg-red-500/20 text-red-400' : i.gravidade === 'moderada' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
                  {i.gravidade}
                </span>
                <span className="text-slate-500 text-xs">{formatarData(i.horario)}</span>
              </div>
              <p className="text-slate-300 text-sm">{i.descricao}</p>
              <p className="text-slate-400 text-sm"><strong className="text-slate-300">Conduta:</strong> {i.conduta}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
