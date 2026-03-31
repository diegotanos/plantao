import type { StatusPaciente } from '@/lib/types'

interface Props {
  status: StatusPaciente
  size?: 'sm' | 'md' | 'lg'
}

const CONFIG: Record<StatusPaciente, { label: string; badge: string; emoji: string }> = {
  estavel: { label: 'Estável', badge: 'bg-green-500/20 text-green-400 border border-green-500/30', emoji: '🟢' },
  atencao: { label: 'Atenção', badge: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30', emoji: '🟡' },
  critico: { label: 'Crítico', badge: 'bg-red-500/20 text-red-400 border border-red-500/30', emoji: '🔴' },
}

const SIZE = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-1.5 text-base',
}

export function PacienteStatus({ status, size = 'md' }: Props) {
  const cfg = CONFIG[status]
  return (
    <span className={`rounded-full font-medium ${cfg.badge} ${SIZE[size]}`}>
      {cfg.emoji} {cfg.label}
    </span>
  )
}
