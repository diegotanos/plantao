'use client'
import { useState } from 'react'
import type { Paciente } from '@/lib/types'

const STATUS_CONFIG = {
  estavel: {
    cor: 'border-green-500/50 bg-green-500/5',
    badge: 'bg-green-500/20 text-green-400',
    emoji: '🟢',
    label: 'Estável',
  },
  atencao: {
    cor: 'border-yellow-500/50 bg-yellow-500/5',
    badge: 'bg-yellow-500/20 text-yellow-400',
    emoji: '🟡',
    label: 'Atenção',
  },
  critico: {
    cor: 'border-red-500/50 bg-red-500/5',
    badge: 'bg-red-500/20 text-red-400',
    emoji: '🔴',
    label: 'Crítico',
  },
}

interface Props {
  paciente: Paciente
  onStatusChange: (id: string, status: Paciente['status']) => void
  onTogglePendencia: (id: string, concluida: boolean) => void
  onRegistrarIntercorrencia: () => void
  readonly?: boolean
}

export function PacienteCard({ paciente: p, onStatusChange, onTogglePendencia, onRegistrarIntercorrencia, readonly }: Props) {
  const [expandido, setExpandido] = useState(false)
  const cfg = STATUS_CONFIG[p.status]
  const pendencias = p.pendencias || []
  const pendenciasAbertas = pendencias.filter(x => !x.concluida).length

  return (
    <div className={`rounded-xl border ${cfg.cor} transition-all`}>
      {/* Header */}
      <div
        className="p-4 cursor-pointer flex items-center justify-between"
        onClick={() => setExpandido(!expandido)}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{cfg.emoji}</span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-semibold">Leito {p.leito}</span>
              <span className="text-slate-400">—</span>
              <span className="text-white">{p.nome}</span>
              {p.idade && <span className="text-slate-400 text-sm">{p.idade}a</span>}
            </div>
            <p className="text-slate-300 text-sm">{p.diagnostico_principal}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-2">
          {pendenciasAbertas > 0 && (
            <span className="bg-orange-500/20 text-orange-400 text-xs px-2 py-1 rounded-full">
              {pendenciasAbertas} pend.
            </span>
          )}
          <span className={`px-2 py-1 rounded-full text-xs ${cfg.badge}`}>{cfg.label}</span>
          <span className="text-slate-500 text-xs">{expandido ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expandido */}
      {expandido && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-700/50 pt-4">
          {/* SBAR */}
          {(p.sbar_situacao || p.sbar_background || p.sbar_avaliacao || p.sbar_recomendacao) && (
            <div className="bg-slate-800/60 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">SBAR</p>
              {p.sbar_situacao && (
                <p className="text-sm text-slate-300">
                  <strong className="text-slate-200">S:</strong> {p.sbar_situacao}
                </p>
              )}
              {p.sbar_background && (
                <p className="text-sm text-slate-300">
                  <strong className="text-slate-200">B:</strong> {p.sbar_background}
                </p>
              )}
              {p.sbar_avaliacao && (
                <p className="text-sm text-slate-300">
                  <strong className="text-slate-200">A:</strong> {p.sbar_avaliacao}
                </p>
              )}
              {p.sbar_recomendacao && (
                <p className="text-sm text-slate-300">
                  <strong className="text-slate-200">R:</strong> {p.sbar_recomendacao}
                </p>
              )}
            </div>
          )}

          {/* Pendências */}
          {pendencias.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Pendências
              </p>
              <div className="space-y-2">
                {pendencias.map(pend => (
                  <div key={pend.id} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={pend.concluida}
                      onChange={e => onTogglePendencia(pend.id, e.target.checked)}
                      disabled={readonly}
                      className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
                    />
                    <span
                      className={`text-sm flex-1 ${
                        pend.concluida ? 'line-through text-slate-500' : 'text-slate-300'
                      }`}
                    >
                      {pend.descricao}
                    </span>
                    <span className="text-xs text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded">
                      {pend.tipo}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ações */}
          {!readonly && (
            <div className="flex gap-2 flex-wrap">
              <select
                value={p.status}
                onChange={e => onStatusChange(p.id, e.target.value as Paciente['status'])}
                className="bg-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm outline-none cursor-pointer"
              >
                <option value="estavel">🟢 Estável</option>
                <option value="atencao">🟡 Atenção</option>
                <option value="critico">🔴 Crítico</option>
              </select>
              <button
                onClick={onRegistrarIntercorrencia}
                className="bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 border border-orange-600/30 px-3 py-2 rounded-lg text-sm transition"
              >
                + Intercorrência
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
