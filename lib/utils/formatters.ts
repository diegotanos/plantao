import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function formatarData(data: string | Date) {
  return format(new Date(data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}

export function formatarDataCurta(data: string | Date) {
  return format(new Date(data), 'dd/MM/yyyy', { locale: ptBR })
}

export function formatarHora(data: string | Date) {
  return format(new Date(data), 'HH:mm', { locale: ptBR })
}

export function tempoRelativo(data: string | Date) {
  return formatDistanceToNow(new Date(data), { addSuffix: true, locale: ptBR })
}

export function duracaoPlantao(inicio: string, fim?: string) {
  const start = new Date(inicio)
  const end = fim ? new Date(fim) : new Date()
  const diff = end.getTime() - start.getTime()
  const horas = Math.floor(diff / (1000 * 60 * 60))
  const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  return `${horas}h${minutos > 0 ? ` ${minutos}min` : ''}`
}
