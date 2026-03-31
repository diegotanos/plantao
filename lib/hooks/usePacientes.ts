'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Paciente, PacienteFormData } from '@/lib/types'

export function usePacientes(plantaoId: string) {
  const supabase = createClient()
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPacientes = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('pacientes')
      .select('*, pendencias(*), intercorrencias(*)')
      .eq('plantao_id', plantaoId)
      .order('leito')
    setPacientes(data || [])
    setLoading(false)
  }, [plantaoId, supabase])

  const adicionarPaciente = async (form: PacienteFormData) => {
    const { data: { user } } = await supabase.auth.getUser()
    const { pendencias, ...pacienteData } = form
    const { data: paciente, error } = await supabase
      .from('pacientes')
      .insert({ ...pacienteData, plantao_id: plantaoId, medico_id: user!.id })
      .select()
      .single()

    if (!error && paciente && pendencias?.length) {
      await supabase.from('pendencias').insert(
        pendencias.map(p => ({ ...p, paciente_id: paciente.id, plantao_id: plantaoId }))
      )
    }
    await fetchPacientes()
    return { data: paciente, error: error?.message }
  }

  const atualizarStatus = async (id: string, status: Paciente['status']) => {
    await supabase.from('pacientes').update({ status }).eq('id', id)
    await fetchPacientes()
  }

  const togglePendencia = async (pendenciaId: string, concluida: boolean) => {
    await supabase.from('pendencias').update({
      concluida,
      concluida_em: concluida ? new Date().toISOString() : null
    }).eq('id', pendenciaId)
    await fetchPacientes()
  }

  useEffect(() => {
    fetchPacientes()
    const channel = supabase
      .channel(`pacientes:${plantaoId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pacientes', filter: `plantao_id=eq.${plantaoId}` },
        () => fetchPacientes()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [plantaoId, fetchPacientes, supabase])

  const criticos = pacientes.filter(p => p.status === 'critico')
  const atencao = pacientes.filter(p => p.status === 'atencao')
  const estaveis = pacientes.filter(p => p.status === 'estavel')

  return {
    pacientes,
    criticos,
    atencao,
    estaveis,
    loading,
    adicionarPaciente,
    atualizarStatus,
    togglePendencia,
    refetch: fetchPacientes,
  }
}
