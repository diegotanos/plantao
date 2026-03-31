'use client'
import type { Pendencia } from '@/lib/types'

interface Props {
  pendencia: Pendencia
  onChange: (id: string, concluida: boolean) => void
  readonly?: boolean
}

const TIPO_COLORS: Record<string, string> = {
  exame: 'bg-purple-500/20 text-purple-400',
  conduta: 'bg-blue-500/20 text-blue-400',
  retorno: 'bg-cyan-500/20 text-cyan-400',
  medicacao: 'bg-pink-500/20 text-pink-400',
  geral: 'bg-slate-500/20 text-slate-400',
}

export function ChecklistItem({ pendencia, onChange, readonly }: Props) {
  return (
    <div className="flex items-center gap-3 py-1">
      <input
        type="checkbox"
        checked={pendencia.concluida}
        onChange={e => onChange(pendencia.id, e.target.checked)}
        disabled={readonly}
        className="w-4 h-4 rounded accent-blue-500 cursor-pointer disabled:cursor-default"
      />
      <span
        className={`text-sm flex-1 ${
          pendencia.concluida ? 'line-through text-slate-500' : 'text-slate-300'
        }`}
      >
        {pendencia.descricao}
      </span>
      <span className={`text-xs px-2 py-0.5 rounded-full ${TIPO_COLORS[pendencia.tipo] || TIPO_COLORS.geral}`}>
        {pendencia.tipo}
      </span>
    </div>
  )
}
