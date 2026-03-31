'use client'
import { usePlantao } from '@/lib/hooks/usePlantao'
import Link from 'next/link'
import { formatarData, duracaoPlantao } from '@/lib/utils/formatters'

const STATUS_COLORS = {
  ativo: 'bg-green-500/20 text-green-400 border-green-500/30',
  passagem_pendente: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  encerrado: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

const STATUS_LABELS = {
  ativo: 'Ativo',
  passagem_pendente: 'Passagem pendente',
  encerrado: 'Encerrado',
}

export default function PlantaoListaPage() {
  const { plantoes, loading } = usePlantao()

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Plantões</h1>
        <Link
          href="/plantao/novo"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          + Novo Plantão
        </Link>
      </div>

      {loading ? (
        <div className="text-slate-400 text-center py-12">Carregando...</div>
      ) : plantoes.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-5xl mb-4">🏥</p>
          <p className="text-lg">Nenhum plantão cadastrado.</p>
          <Link href="/plantao/novo" className="text-blue-400 hover:underline text-sm mt-2 inline-block">
            Iniciar primeiro plantão →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {plantoes.map(p => {
            const criticos = (p.pacientes || []).filter(pa => pa.status === 'critico').length
            return (
              <Link key={p.id} href={`/plantao/${p.id}`}>
                <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 hover:border-slate-500 transition">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-semibold text-lg">{p.setor}</p>
                        {criticos > 0 && (
                          <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full">
                            {criticos} crítico(s)
                          </span>
                        )}
                      </div>
                      {p.hospital && <p className="text-slate-400 text-sm">{p.hospital}</p>}
                      <p className="text-slate-500 text-sm">{formatarData(p.inicio)}</p>
                      {p.fim && (
                        <p className="text-slate-500 text-sm">
                          Duração: {duracaoPlantao(p.inicio, p.fim)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs border ${STATUS_COLORS[p.status]}`}>
                        {STATUS_LABELS[p.status]}
                      </span>
                      <span className="text-slate-400 text-sm">{p.pacientes?.length || 0} pacientes</span>
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
