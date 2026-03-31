import type { TipoNotificacao } from '@/lib/types'

interface Props {
  tipo: TipoNotificacao
  texto: string
}

const CONFIG: Record<TipoNotificacao, { class: string; icon: string }> = {
  info: { class: 'bg-blue-500/10 border-blue-500/30 text-blue-400', icon: 'ℹ️' },
  alerta: { class: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400', icon: '⚠️' },
  critico: { class: 'bg-red-500/10 border-red-500/30 text-red-400', icon: '🚨' },
  passagem: { class: 'bg-purple-500/10 border-purple-500/30 text-purple-400', icon: '🔄' },
}

export function AlertaBadge({ tipo, texto }: Props) {
  const cfg = CONFIG[tipo]
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${cfg.class} text-sm`}>
      <span>{cfg.icon}</span>
      <span>{texto}</span>
    </div>
  )
}
