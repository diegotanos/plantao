import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { plantaoId, emailReceptor, obsFinais } = await req.json()

  if (!plantaoId || !emailReceptor) {
    return NextResponse.json({ error: 'plantaoId e emailReceptor são obrigatórios' }, { status: 400 })
  }

  // Busca perfil pelo email (campo sincronizado via trigger)
  const { data: perfilReceptor, error: perfilError } = await supabase
    .from('perfis')
    .select('id,nome')
    .eq('email', emailReceptor)
    .single()

  if (perfilError || !perfilReceptor) {
    return NextResponse.json({
      error: 'Médico receptor não encontrado. Verifique se o e-mail está cadastrado no sistema.',
    }, { status: 404 })
  }

  const { error } = await supabase
    .from('plantoes')
    .update({
      status: 'encerrado',
      medico_recebeu_id: perfilReceptor.id,
      observacoes_gerais: obsFinais || null,
      confirmado_em: new Date().toISOString(),
    })
    .eq('id', plantaoId)
    .eq('medico_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notifica receptor
  await supabase.from('notificacoes').insert({
    usuario_id: perfilReceptor.id,
    titulo: 'Plantão recebido',
    mensagem: 'Você recebeu a passagem de um plantão. Confira os pacientes.',
    tipo: 'passagem',
    plantao_id: plantaoId,
  })

  return NextResponse.json({ ok: true })
}
