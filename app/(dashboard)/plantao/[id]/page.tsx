'use client'
import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { usePacientes } from '@/lib/hooks/usePacientes'
import { useIntercorrencias } from '@/lib/hooks/useIntercorrencias'
import { usePlantao } from '@/lib/hooks/usePlantao'
import { PacienteCard } from '@/components/paciente/PacienteCard'
import { PacienteForm } from '@/components/paciente/PacienteForm'
import { IntercorrenciaForm } from '@/components/intercorrencia/IntercorrenciaForm'
import { PlantaoHeader } from '@/components/plantao/PlantaoHeader'
import Link from 'next/link'

type Tab = 'pacientes' | 'intercorrencias'

export default function PlantaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('pacientes')
  const [showAddPaciente, setShowAddPaciente] = useState(false)
  const [showAddIntercorrencia, setShowAddIntercorrencia] = useState(false)

  const { plantao, encerrarPlantao } = usePlantao(id)
  const { pacientes, criticos, atencao, loading, adicionarPaciente, atualizarStatus, togglePendencia } = usePacientes(id)
  const { intercorrencias, registrarIntercorrencia } = useIntercorrencias(id)

  const tabs = [
    { id: 'pacientes', label: `Pacientes (${pacientes.length})` },
    { id: 'intercorrencias', label: `Intercorrências (${intercorrencias.length})` },
  ]

  const handleEncerrar = async () => {
    if (!confirm('Deseja encerrar o plantão e ir para a tela de passagem?')) return
    await encerrarPlantao(id)
    router.push(`/plantao/${id}/passagem`)
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header do plantão */}
      {plantao && (
        <PlantaoHeader
          plantao={plantao}
          totalPacientes={pacientes.length}
          onEncerrar={handleEncerrar}
        />
      )}

      {/* Alertas críticos */}
      {criticos.length > 0 && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4">
          <p className="text-red-400 font-semibold">⚠️ {criticos.length} paciente(s) em estado crítico</p>
          <p className="text-red-300 text-sm mt-1">
            {criticos.map(p => `Leito ${p.leito} — ${p.nome}`).join(' • ')}
          </p>
        </div>
      )}

      {/* Passagem pendente */}
      {plantao?.status === 'passagem_pendente' && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-center justify-between">
          <p className="text-yellow-400 font-medium">Passagem de plantão pendente</p>
          <Link
            href={`/plantao/${id}/passagem`}
            className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            Fazer passagem →
          </Link>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as Tab)}
            className={`pb-3 px-4 text-sm font-medium transition border-b-2 ${
              tab === t.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Pacientes */}
      {tab === 'pacientes' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex gap-3 text-sm">
              <span className="text-red-400">🔴 {criticos.length} crítico(s)</span>
              <span className="text-yellow-400">🟡 {atencao.length} atenção</span>
            </div>
            {plantao?.status === 'ativo' && (
              <button
                onClick={() => setShowAddPaciente(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
              >
                + Paciente
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-slate-400 text-center py-8">Carregando...</div>
          ) : pacientes.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="text-4xl mb-3">🛏</p>
              <p>Nenhum paciente cadastrado ainda.</p>
            </div>
          ) : (
            pacientes.map(p => (
              <PacienteCard
                key={p.id}
                paciente={p}
                onStatusChange={atualizarStatus}
                onTogglePendencia={togglePendencia}
                onRegistrarIntercorrencia={() => setShowAddIntercorrencia(true)}
                readonly={plantao?.status !== 'ativo'}
              />
            ))
          )}
        </div>
      )}

      {/* Tab: Intercorrências */}
      {tab === 'intercorrencias' && (
        <div className="space-y-3">
          {plantao?.status === 'ativo' && (
            <button
              onClick={() => setShowAddIntercorrencia(true)}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white px-4 py-3 rounded-lg text-sm font-medium transition border border-slate-600"
            >
              + Registrar Intercorrência
            </button>
          )}
          {intercorrencias.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="text-4xl mb-3">📝</p>
              <p>Nenhuma intercorrência registrada.</p>
            </div>
          ) : (
            intercorrencias.map(i => (
              <div key={i.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-white font-medium">
                      Leito {i.paciente?.leito} — {i.paciente?.nome}
                    </p>
                    <p className="text-slate-300 text-sm mt-1">{i.descricao}</p>
                    <p className="text-slate-400 text-sm mt-1">
                      <strong className="text-slate-300">Conduta:</strong> {i.conduta}
                    </p>
                    {i.resultado && (
                      <p className="text-slate-400 text-sm">
                        <strong className="text-slate-300">Resultado:</strong> {i.resultado}
                      </p>
                    )}
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        i.gravidade === 'grave'
                          ? 'bg-red-500/20 text-red-400'
                          : i.gravidade === 'moderada'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-green-500/20 text-green-400'
                      }`}
                    >
                      {i.gravidade}
                    </span>
                    <p className="text-slate-500 text-xs mt-1">
                      {new Date(i.horario).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modais */}
      {showAddPaciente && (
        <PacienteForm
          onSalvar={async data => {
            await adicionarPaciente(data)
            setShowAddPaciente(false)
          }}
          onCancelar={() => setShowAddPaciente(false)}
        />
      )}
      {showAddIntercorrencia && (
        <IntercorrenciaForm
          pacientes={pacientes}
          onSalvar={async data => {
            await registrarIntercorrencia(data)
            setShowAddIntercorrencia(false)
          }}
          onCancelar={() => setShowAddIntercorrencia(false)}
        />
      )}
    </div>
  )
}
