'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Plantao, PlantaoFormData, PassagemFormData } from '@/lib/types'

export function usePlantao(plantaoId?: string) {
  const supabase = createClient()
  const [plantao, setPlantao] = useState<Plantao | null>(null)
  const [plantoes, setPlantoes] = useState<Plantao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPlantoes = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('plantoes')
      .select(`*, medico:perfis!medico_id(nome,crm), pacientes(id,status)`)
      .order('inicio', { ascending: false })
    if (error) setError(error.message)
    else setPlantoes(data || [])
    setLoading(false)
  }, [supabase])

  const fetchPlantao = useCallback(async (id: string) => {
    setLoading(true)
    const { data, error } = await supabase
      .from('plantoes')
      .select(`*, medico:perfis!medico_id(nome,crm), pacientes(*, pendencias(*), intercorrencias(*))`)
      .eq('id', id)
      .single()
    if (error) setError(error.message)
    else setPlantao(data)
    setLoading(false)
  }, [supabase])

  const criarPlantao = async (form: PlantaoFormData) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Não autenticado' }
    const { data, error } = await supabase
      .from('plantoes')
      .insert({ ...form, medico_id: user.id })
      .select()
      .single()
    return { data, error: error?.message }
  }

  const encerrarPlantao = async (id: string) => {
    const { error } = await supabase
      .from('plantoes')
      .update({ status: 'passagem_pendente', fim: new Date().toISOString() })
      .eq('id', id)
    return { error: error?.message }
  }

  const confirmarPassagem = async (id: string, form: PassagemFormData) => {
    const { error } = await supabase
      .from('plantoes')
      .update({
        status: 'encerrado',
        medico_recebeu_id: form.medico_recebeu_id,
        observacoes_gerais: form.observacoes_finais,
        confirmado_em: new Date().toISOString(),
      })
      .eq('id', id)

    if (!error) {
      await supabase.from('notificacoes').insert({
        usuario_id: form.medico_recebeu_id,
        titulo: 'Plantão recebido',
        mensagem: 'Você recebeu a passagem de um plantão. Confira os pacientes.',
        tipo: 'passagem',
        plantao_id: id,
      })
    }
    return { error: error?.message }
  }

  useEffect(() => {
    if (plantaoId) fetchPlantao(plantaoId)
    else fetchPlantoes()
  }, [plantaoId, fetchPlantao, fetchPlantoes])

  return {
    plantao,
    plantoes,
    loading,
    error,
    criarPlantao,
    encerrarPlantao,
    confirmarPassagem,
    refetch: plantaoId ? () => fetchPlantao(plantaoId) : fetchPlantoes,
  }
}
