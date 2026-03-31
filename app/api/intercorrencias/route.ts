import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const plantaoId = req.nextUrl.searchParams.get('plantaoId')
  const query = supabase
    .from('intercorrencias')
    .select('*, paciente:pacientes(nome,leito)')
    .order('horario', { ascending: false })

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
  const { data, error } = await supabase
    .from('intercorrencias')
    .insert({ ...body, medico_id: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (body.gravidade === 'grave') {
    const { data: paciente } = await supabase
      .from('pacientes')
      .select('medico_id,nome')
      .eq('id', body.paciente_id)
      .single()

    if (paciente) {
      await supabase.from('notificacoes').insert({
        usuario_id: paciente.medico_id,
        titulo: `⚠️ Intercorrência grave — ${paciente.nome}`,
        mensagem: body.descricao,
        tipo: 'critico',
        plantao_id: body.plantao_id,
        paciente_id: body.paciente_id,
      })
    }
  }

  return NextResponse.json(data, { status: 201 })
}
