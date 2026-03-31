'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Stats {
  totalPlantoes: number
  plantoesMes: number
  totalPacientes: number
  totalIntercorrencias: number
  intercorrenciasGraves: number
  mediaHorasPlantao: number
}

export default function EstatisticasPage() {
  const supabase = createClient()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      const mesAtual = new Date()
      mesAtual.setDate(1)
      mesAtual.setHours(0, 0, 0, 0)

      const [plantoes, pacientes, intercorrencias] = await Promise.all([
        supabase.from('plantoes').select('id,inicio,fim,status'),
        supabase.from('pacientes').select('id'),
        supabase.from('intercorrencias').select('id,gravidade'),
      ])

      const p = plantoes.data || []
      const encerrados = p.filter(x => x.fim)
      let mediaHoras = 0
      if (encerrados.length > 0) {
        const totalMs = encerrados.reduce((acc, x) => {
          return acc + (new Date(x.fim!).getTime() - new Date(x.inicio).getTime())
        }, 0)
        mediaHoras = Math.round(totalMs / encerrados.length / (1000 * 60 * 60))
      }

      setStats({
        totalPlantoes: p.length,
        plantoesMes: p.filter(x => new Date(x.inicio) >= mesAtual).length,
        totalPacientes: (pacientes.data || []).length,
        totalIntercorrencias: (intercorrencias.data || []).length,
        intercorrenciasGraves: (intercorrencias.data || []).filter(i => i.gravidade === 'grave').length,
        mediaHorasPlantao: mediaHoras,
      })
      setLoading(false)
    }
    fetchStats()
  }, [supabase])

  if (loading) return <div className="p-6 text-slate-400">Carregando estatísticas...</div>

  const cards = [
    { label: 'Total de plantões', value: stats?.totalPlantoes, icon: '📋', color: 'text-blue-400' },
    { label: 'Plantões este mês', value: stats?.plantoesMes, icon: '📅', color: 'text-purple-400' },
    { label: 'Total de pacientes', value: stats?.totalPacientes, icon: '🛏', color: 'text-green-400' },
    { label: 'Intercorrências', value: stats?.totalIntercorrencias, icon: '📝', color: 'text-yellow-400' },
    { label: 'Intercorrências graves', value: stats?.intercorrenciasGraves, icon: '⚠️', color: 'text-red-400' },
    { label: 'Média horas/plantão', value: stats?.mediaHorasPlantao ? `${stats.mediaHorasPlantao}h` : 'N/A', icon: '⏱', color: 'text-cyan-400' },
  ]

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Estatísticas</h1>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(card => (
          <div key={card.label} className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <div className="text-3xl mb-2">{card.icon}</div>
            <div className={`text-3xl font-bold ${card.color}`}>{card.value ?? 0}</div>
            <div className="text-slate-400 text-sm mt-1">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <h2 className="text-white font-semibold mb-3">Resumo</h2>
        <div className="space-y-2 text-sm text-slate-400">
          <p>• Dados referentes a todos os plantões registrados na sua conta</p>
          <p>• Pacientes somam todos os plantões (sem deduplicação)</p>
          <p>• Média de horas calculada sobre plantões encerrados</p>
        </div>
      </div>
    </div>
  )
}
