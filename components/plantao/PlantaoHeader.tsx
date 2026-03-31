'use client'
import type { Plantao } from '@/lib/types'
import { duracaoPlantao } from '@/lib/utils/formatters'
import Link from 'next/link'

interface Props {
  plantao: Plantao
  totalPacientes: number
  onEncerrar?: () => void
}

const STATUS_CONFIG = {
  ativo: { label: 'Ativo', class: 'bg-green-500/20 text-green-400 border-green-500/30' },
  passagem_pendente: { label: 'Passagem pendente', class: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  encerrado: { label: 'Encerrado', class: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
}

export function PlantaoHeader({ plantao, totalPacientes, onEncerrar }: Props) {
  const cfg = STATUS_CONFIG[plantao.status]

  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">{plantao.setor}</h1>
            <span className={`px-3 py-1 rounded-full text-xs border ${cfg.class}`}>{cfg.label}</span>
          </div>
          {plantao.hospital && <p className="text-slate-400 text-sm">{plantao.hospital}</p>}
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span>⏱ {duracaoPlantao(plantao.inicio, plantao.fim)}</span>
            <span>🛏 {totalPacientes} pacientes</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 items-end">
          {plantao.status === 'ativo' && onEncerrar && (
            <button
              onClick={onEncerrar}
              className="bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 border border-yellow-600/30 px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              Encerrar Plantão →
            </button>
          )}
          {plantao.status === 'passagem_pendente' && (
            <Link
              href={`/plantao/${plantao.id}/passagem`}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              Fazer Passagem →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
