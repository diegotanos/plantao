'use client'
import { usePlantao } from '@/lib/hooks/usePlantao'
import { useNotificacoes } from '@/lib/hooks/useNotificacoes'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'

const STATUS_COLORS = {
  ativo: 'bg-green-500/20 text-green-400 border-green-500/30',
  passagem_pendente: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  encerrado: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

const STATUS_LABELS = {
  ativo: 'Ativo',
  passagem_pendente: 'Passagem pendente',
  encerrado: 'Encerrado',
}

export default function DashboardPage() {
  const { plantoes, loading } = usePlantao()
  const { naoLidas } = useNotificacoes()

  const plantaoAtivo = plantoes.find(p => p.status === 'ativo')
  const criticos = plantoes.flatMap(p => p.pacientes || []).filter(p => p.status === 'critico')

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <Link
          href="/plantao/novo"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          + Novo Plantão
        </Link>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Plantão ativo', value: plantaoAtivo ? '1' : '0', icon: '🟢', color: 'text-green-400' },
          { label: 'Pacientes críticos', value: String(criticos.length), icon: '🔴', color: 'text-red-400' },
          {
            label: 'Plantões hoje',
            value: String(plantoes.filter(p => new Date(p.inicio).toDateString() === new Date().toDateString()).length),
            icon: '📋',
            color: 'text-blue-400',
          },
          { label: 'Notificações', value: String(naoLidas), icon: '🔔', color: 'text-yellow-400' },
        ].map(card => (
          <div key={card.label} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <div className="text-2xl mb-1">{card.icon}</div>
            <div className={`text-3xl font-bold ${card.color}`}>{card.value}</div>
            <div className="text-slate-400 text-sm">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Plantão ativo em destaque */}
      {plantaoAtivo && (
        <Link href={`/plantao/${plantaoAtivo.id}`}>
          <div className="bg-gradient-to-r from-blue-600/30 to-blue-800/30 border border-blue-500/30 rounded-xl p-5 cursor-pointer hover:border-blue-400/50 transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-300 text-sm font-medium">PLANTÃO EM ANDAMENTO</p>
                <p className="text-white text-xl font-bold mt-1">{plantaoAtivo.setor}</p>
                <p className="text-slate-300 text-sm">
                  Iniciado {formatDistanceToNow(new Date(plantaoAtivo.inicio), { addSuffix: true, locale: ptBR })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">{plantaoAtivo.pacientes?.length || 0}</p>
                <p className="text-slate-300 text-sm">pacientes</p>
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* Lista de plantões recentes */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">Plantões recentes</h2>
        {loading ? (
          <div className="text-slate-400 text-center py-8">Carregando...</div>
        ) : plantoes.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-4xl mb-3">📋</p>
            <p>Nenhum plantão ainda.</p>
            <Link href="/plantao/novo" className="text-blue-400 hover:underline text-sm mt-2 inline-block">
              Iniciar primeiro plantão →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {plantoes.slice(0, 10).map(p => (
              <Link key={p.id} href={`/plantao/${p.id}`}>
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 hover:border-slate-500 transition flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">{p.setor}</p>
                    <p className="text-slate-400 text-sm">
                      {new Date(p.inicio).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-300 text-sm">{p.pacientes?.length || 0} pac.</span>
                    <span className={`px-2 py-1 rounded-full text-xs border ${STATUS_COLORS[p.status]}`}>
                      {STATUS_LABELS[p.status]}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
