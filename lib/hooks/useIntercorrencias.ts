'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Intercorrencia, IntercorrenciaFormData } from '@/lib/types'

export function useIntercorrencias(plantaoId: string) {
  const supabase = createClient()
  const [intercorrencias, setIntercorrencias] = useState<Intercorrencia[]>([])
  const [loading, setLoading] = useState(true)

  const fetchIntercorrencias = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('intercorrencias')
      .select('*, paciente:pacientes(nome,leito)')
      .eq('plantao_id', plantaoId)
      .order('horario', { ascending: false })
    setIntercorrencias(data || [])
    setLoading(false)
  }, [plantaoId, supabase])

  const registrarIntercorrencia = async (form: IntercorrenciaFormData) => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('intercorrencias')
      .insert({ ...form, plantao_id: plantaoId, medico_id: user!.id })
      .select()
      .single()

    if (!error && form.gravidade === 'grave') {
      const paciente = await supabase
        .from('pacientes')
        .select('medico_id,nome')
        .eq('id', form.paciente_id)
        .single()
      if (paciente.data) {
        await supabase.from('notificacoes').insert({
          usuario_id: paciente.data.medico_id,
          titulo: `⚠️ Intercorrência grave — ${paciente.data.nome}`,
          mensagem: form.descricao,
          tipo: 'critico',
          plantao_id: plantaoId,
          paciente_id: form.paciente_id,
        })
      }
    }
    await fetchIntercorrencias()
    return { data, error: error?.message }
  }

  useEffect(() => { fetchIntercorrencias() }, [fetchIntercorrencias])

  return { intercorrencias, loading, registrarIntercorrencia, refetch: fetchIntercorrencias }
}
