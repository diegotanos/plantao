import type { Plantao } from '@/lib/types'

export function gerarConteudoPDF(plantao: Plantao): string {
  const linhas: string[] = []

  linhas.push('PASSAGEM DE PLANTÃO')
  linhas.push(`Setor: ${plantao.setor}`)
  if (plantao.hospital) linhas.push(`Hospital: ${plantao.hospital}`)
  linhas.push(`Data: ${new Date(plantao.inicio).toLocaleString('pt-BR')}`)
  linhas.push('')

  for (const p of plantao.pacientes || []) {
    const statusLabel = p.status === 'critico' ? '[CRÍTICO]' : p.status === 'atencao' ? '[ATENÇÃO]' : '[ESTÁVEL]'
    linhas.push(`Leito ${p.leito} — ${p.nome} ${statusLabel}`)
    linhas.push(`  Diagnóstico: ${p.diagnostico_principal}`)

    if (p.sbar_situacao) linhas.push(`  S: ${p.sbar_situacao}`)
    if (p.sbar_background) linhas.push(`  B: ${p.sbar_background}`)
    if (p.sbar_avaliacao) linhas.push(`  A: ${p.sbar_avaliacao}`)
    if (p.sbar_recomendacao) linhas.push(`  R: ${p.sbar_recomendacao}`)

    const pendencias = (p.pendencias || []).filter(x => !x.concluida)
    if (pendencias.length > 0) {
      linhas.push('  Pendências:')
      for (const pend of pendencias) {
        linhas.push(`    • ${pend.descricao} [${pend.tipo}]`)
      }
    }
    linhas.push('')
  }

  return linhas.join('\n')
}
