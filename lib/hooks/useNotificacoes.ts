'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Notificacao } from '@/lib/types'

export function useNotificacoes() {
  const supabase = createClient()
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])

  useEffect(() => {
    const fetchNotificacoes = async () => {
      const { data } = await supabase
        .from('notificacoes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      setNotificacoes(data || [])
    }

    fetchNotificacoes()

    const channel = supabase
      .channel('notificacoes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificacoes' },
        payload => setNotificacoes(prev => [payload.new as Notificacao, ...prev])
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  const marcarLida = async (id: string) => {
    await supabase.from('notificacoes').update({ lida: true }).eq('id', id)
    setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n))
  }

  const naoLidas = notificacoes.filter(n => !n.lida).length

  return { notificacoes, naoLidas, marcarLida }
}
