import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const plantaoId = req.nextUrl.searchParams.get('plantaoId')
  const query = supabase
    .from('pacientes')
    .select('*, pendencias(*), intercorrencias(*)')
    .order('leito')

  if (plantaoId) query.eq('plantao_id', plantaoId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json()
  const { pendencias, ...pacienteData } = body

  const { data: paciente, error } = await supabase
    .from('pacientes')
    .insert({ ...pacienteData, medico_id: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (pendencias?.length && paciente) {
    await supabase.from('pendencias').insert(
      pendencias.map((p: { descricao: string; tipo: string }) => ({
        ...p,
        paciente_id: paciente.id,
        plantao_id: pacienteData.plantao_id,
      }))
    )
  }

  return NextResponse.json(paciente, { status: 201 })
}
