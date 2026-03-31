import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import jsPDF from 'jspdf'

export async function GET(req: NextRequest) {
  const plantaoId = req.nextUrl.searchParams.get('plantaoId')
  if (!plantaoId) return NextResponse.json({ error: 'plantaoId obrigatório' }, { status: 400 })

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: plantao } = await supabase
    .from('plantoes')
    .select('*, pacientes(*, pendencias(*), intercorrencias(*))')
    .eq('id', plantaoId)
    .single()

  if (!plantao) return NextResponse.json({ error: 'Plantão não encontrado' }, { status: 404 })

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const M = 15
  let y = M

  const nl = (h = 6) => { y += h }

  const text = (t: string, x = M, size = 10, bold = false) => {
    doc.setFontSize(size)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    // Quebra texto longo
    const maxWidth = W - M * 2 - (x - M)
    const lines = doc.splitTextToSize(t, maxWidth)
    doc.text(lines, x, y)
    if (lines.length > 1) y += (lines.length - 1) * (size * 0.4)
  }

  const line = () => {
    doc.setDrawColor(60, 70, 90)
    doc.line(M, y, W - M, y)
    nl(4)
  }

  // Cabeçalho
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, W, 30, 'F')
  doc.setTextColor(255, 255, 255)
  text('PASSAGEM DE PLANTÃO', M, 16, true)
  nl(7)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Setor: ${plantao.setor}${plantao.hospital ? ` · ${plantao.hospital}` : ''}`, M, y)
  nl(5)
  doc.text(`Data: ${new Date(plantao.inicio).toLocaleString('pt-BR')}`, M, y)
  nl(8)
  doc.setTextColor(30, 40, 50)

  line()

  // Sumário
  const pacientes = plantao.pacientes || []
  const criticos = pacientes.filter((p: { status: string }) => p.status === 'critico').length
  const atencao = pacientes.filter((p: { status: string }) => p.status === 'atencao').length
  const estaveis = pacientes.filter((p: { status: string }) => p.status === 'estavel').length

  text(`Total de pacientes: ${pacientes.length}   Críticos: ${criticos}   Atenção: ${atencao}   Estáveis: ${estaveis}`, M, 10, true)
  nl(8)
  line()

  // Pacientes
  for (const p of pacientes) {
    if (y > 255) { doc.addPage(); y = M }

    const statusLabel = p.status === 'critico' ? '[CRÍTICO]' : p.status === 'atencao' ? '[ATENÇÃO]' : '[ESTÁVEL]'

    // Fundo colorido por status
    const bgColor: [number, number, number] = p.status === 'critico' ? [80, 20, 20] : p.status === 'atencao' ? [70, 55, 10] : [20, 50, 30]
    doc.setFillColor(...bgColor)
    doc.rect(M, y - 4, W - M * 2, 8, 'F')

    doc.setTextColor(255, 255, 255)
    text(`Leito ${p.leito} — ${p.nome}${p.idade ? ` (${p.idade}a)` : ''} ${statusLabel}`, M + 2, 11, true)
    nl(6)
    doc.setTextColor(30, 40, 50)

    text(`Diagnóstico: ${p.diagnostico_principal}`, M + 3)
    nl(5)

    if (p.sbar_situacao) { text(`S: ${p.sbar_situacao}`, M + 3, 9); nl(4) }
    if (p.sbar_background) { text(`B: ${p.sbar_background}`, M + 3, 9); nl(4) }
    if (p.sbar_avaliacao) { text(`A: ${p.sbar_avaliacao}`, M + 3, 9); nl(4) }
    if (p.sbar_recomendacao) { text(`R: ${p.sbar_recomendacao}`, M + 3, 9); nl(4) }

    const pAbertos = (p.pendencias || []).filter((x: { concluida: boolean }) => !x.concluida)
    if (pAbertos.length > 0) {
      text('Pendências em aberto:', M + 3, 9, true)
      nl(4)
      for (const pend of pAbertos) {
        text(`  • [${pend.tipo}] ${pend.descricao}`, M + 3, 9)
        nl(4)
      }
    }

    const intercs = p.intercorrencias || []
    if (intercs.length > 0) {
      text(`Intercorrências: ${intercs.length} registrada(s)`, M + 3, 9, true)
      nl(4)
    }

    nl(2)
    doc.setDrawColor(200, 200, 210)
    doc.line(M, y, W - M, y)
    nl(5)
  }

  // Observações gerais
  if (plantao.observacoes_gerais) {
    if (y > 240) { doc.addPage(); y = M }
    line()
    text('Observações gerais:', M, 10, true)
    nl(5)
    text(plantao.observacoes_gerais, M + 3, 9)
    nl(6)
  }

  // Rodapé
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 160)
    doc.text(`PlantãoApp · Gerado em ${new Date().toLocaleString('pt-BR')} · Página ${i}/${pageCount}`, M, 290)
  }

  const pdfBytes = doc.output('arraybuffer')
  return new NextResponse(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="passagem-${plantaoId.slice(0, 8)}.pdf"`,
    },
  })
}
