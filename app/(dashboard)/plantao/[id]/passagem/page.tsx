'use client'
export const dynamic = 'force-dynamic'
import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { usePlantao } from '@/lib/hooks/usePlantao'
import { usePacientes } from '@/lib/hooks/usePacientes'
import { useIntercorrencias } from '@/lib/hooks/useIntercorrencias'

export default function PassagemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { plantao, confirmarPassagem } = usePlantao(id)
  const { pacientes, criticos, atencao } = usePacientes(id)
  const { intercorrencias } = useIntercorrencias(id)
  const [emailReceptor, setEmailReceptor] = useState('')
  const [obsFinais, setObsFinais] = useState('')
  const [loading, setLoading] = useState(false)
  const [etapa, setEtapa] = useState<'resumo' | 'receptor'>('resumo')

  const pendenciasAbertas = pacientes.flatMap(p => p.pendencias || []).filter(p => !p.concluida)

  const handleConfirmar = async () => {
    if (!emailReceptor.trim()) return
    setLoading(true)
    const res = await fetch('/api/passagem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plantaoId: id, emailReceptor, obsFinais }),
    })
    if (res.ok) router.push('/')
    else {
      const json = await res.json()
      alert(json.error || 'Erro ao confirmar passagem.')
    }
    setLoading(false)
  }

  const handleGerarPDF = async () => {
    const res = await fetch(`/api/pdf?plantaoId=${id}`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `passagem-plantao-${new Date().toISOString().slice(0, 10)}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Passagem de Plantão</h1>
        {plantao && (
          <p className="text-slate-400 text-sm mt-1">
            Setor: {plantao.setor} — {pacientes.length} paciente(s)
          </p>
        )}
      </div>

      {/* Etapa 1: Resumo */}
      {etapa === 'resumo' && (
        <>
          {(criticos.length > 0 || atencao.length > 0 || pendenciasAbertas.length > 0) && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 space-y-2">
              <p className="text-yellow-400 font-semibold">⚠️ Itens que precisam de atenção</p>
              {criticos.length > 0 && (
                <p className="text-yellow-300 text-sm">🔴 {criticos.length} paciente(s) crítico(s)</p>
              )}
              {atencao.length > 0 && (
                <p className="text-yellow-300 text-sm">🟡 {atencao.length} paciente(s) em atenção</p>
              )}
              {pendenciasAbertas.length > 0 && (
                <p className="text-yellow-300 text-sm">📋 {pendenciasAbertas.length} pendência(s) em aberto</p>
              )}
            </div>
          )}

          <div>
            <h2 className="text-lg font-semibold text-white mb-3">Pacientes ({pacientes.length})</h2>
            <div className="space-y-3">
              {pacientes.map(p => {
                const pendAbertos = (p.pendencias || []).filter(x => !x.concluida)
                const interc = intercorrencias.filter(i => i.paciente_id === p.id)
                return (
                  <div key={p.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-white font-medium">
                          Leito {p.leito} — {p.nome}
                          {p.idade ? ` (${p.idade}a)` : ''}
                        </p>
                        <p className="text-slate-400 text-sm">{p.diagnostico_principal}</p>
                        {p.sbar_recomendacao && (
                          <p className="text-slate-300 text-sm mt-2">
                            <strong className="text-slate-200">Recomendação:</strong> {p.sbar_recomendacao}
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ml-3 shrink-0 ${
                          p.status === 'critico'
                            ? 'bg-red-500/20 text-red-400'
                            : p.status === 'atencao'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-green-500/20 text-green-400'
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>
                    {pendAbertos.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-700/50">
                        <p className="text-orange-400 text-xs font-medium mb-1">Pendências abertas:</p>
                        {pendAbertos.map(pend => (
                          <p key={pend.id} className="text-slate-400 text-xs">
                            • [{pend.tipo}] {pend.descricao}
                          </p>
                        ))}
                      </div>
                    )}
                    {interc.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-700/50">
                        <p className="text-blue-400 text-xs">
                          📋 {interc.length} intercorrência(s) neste plantão
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleGerarPDF}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg text-sm transition"
            >
              📄 Exportar PDF
            </button>
            <button
              onClick={() => setEtapa('receptor')}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg text-sm font-semibold transition"
            >
              Continuar →
            </button>
          </div>
        </>
      )}

      {/* Etapa 2: Identificar receptor */}
      {etapa === 'receptor' && (
        <div className="space-y-4">
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 space-y-4">
            <h2 className="text-white font-semibold">Médico que recebe o plantão</h2>
            <div>
              <label className="block text-slate-400 text-xs uppercase tracking-wider mb-1">
                E-mail do colega *
              </label>
              <input
                type="email"
                value={emailReceptor}
                onChange={e => setEmailReceptor(e.target.value)}
                placeholder="colega@hospital.com"
                className="w-full bg-slate-700 text-white rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
              />
              <p className="text-slate-500 text-xs mt-1">
                O colega receberá uma notificação no app.
              </p>
            </div>
            <div>
              <label className="block text-slate-400 text-xs uppercase tracking-wider mb-1">
                Observações finais (opcional)
              </label>
              <textarea
                rows={3}
                value={obsFinais}
                onChange={e => setObsFinais(e.target.value)}
                placeholder="Alguma informação geral importante para o próximo plantão..."
                className="w-full bg-slate-700 text-white rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setEtapa('resumo')}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg text-sm transition"
            >
              ← Voltar
            </button>
            <button
              onClick={handleConfirmar}
              disabled={loading || !emailReceptor}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg text-sm font-semibold transition disabled:opacity-50"
            >
              {loading ? 'Confirmando...' : '✓ Confirmar Passagem'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
