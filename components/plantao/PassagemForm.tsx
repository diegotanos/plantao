'use client'
import { useState } from 'react'
import type { PassagemFormData } from '@/lib/types'

interface Props {
  onConfirmar: (data: PassagemFormData & { email: string }) => Promise<void>
  onCancelar: () => void
}

export function PassagemForm({ onConfirmar, onCancelar }: Props) {
  const [email, setEmail] = useState('')
  const [obsFinais, setObsFinais] = useState('')
  const [loading, setLoading] = useState(false)

  const handleConfirmar = async () => {
    if (!email.trim()) return
    setLoading(true)
    await onConfirmar({ medico_recebeu_id: '', email, observacoes_finais: obsFinais })
    setLoading(false)
  }

  const inputClass =
    'w-full bg-slate-700 text-white rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500'

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 border border-slate-700">
        <h2 className="text-white text-lg font-bold">Confirmar Passagem</h2>

        <div>
          <label className="block text-slate-400 text-xs uppercase tracking-wider mb-1">
            E-mail do médico receptor *
          </label>
          <input
            type="email"
            className={inputClass}
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="colega@hospital.com"
          />
        </div>

        <div>
          <label className="block text-slate-400 text-xs uppercase tracking-wider mb-1">
            Observações finais
          </label>
          <textarea
            rows={3}
            className={inputClass}
            value={obsFinais}
            onChange={e => setObsFinais(e.target.value)}
            placeholder="Informações gerais para o próximo plantão..."
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancelar}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-3 rounded-lg text-sm transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={loading || !email}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg text-sm font-semibold transition disabled:opacity-50"
          >
            {loading ? 'Confirmando...' : '✓ Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
