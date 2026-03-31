'use client'
import { useState } from 'react'
import type { IntercorrenciaFormData, Paciente as PacienteType } from '@/lib/types'

interface Props {
  pacientes: PacienteType[]
  onSalvar: (data: IntercorrenciaFormData) => Promise<void>
  onCancelar: () => void
}

export function IntercorrenciaForm({ pacientes, onSalvar, onCancelar }: Props) {
  const [form, setForm] = useState<IntercorrenciaFormData>({
    paciente_id: pacientes[0]?.id || '',
    descricao: '',
    conduta: '',
    resultado: '',
    gravidade: 'leve',
  })
  const [loading, setLoading] = useState(false)

  const set = (k: keyof IntercorrenciaFormData, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSalvar = async () => {
    if (!form.paciente_id || !form.descricao || !form.conduta) return
    setLoading(true)
    await onSalvar(form)
    setLoading(false)
  }

  const inputClass =
    'w-full bg-slate-700 text-white rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500'
  const labelClass = 'block text-slate-400 text-xs font-medium uppercase tracking-wider mb-1'

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 border border-slate-700">
        <div className="flex items-center justify-between">
          <h2 className="text-white text-lg font-bold">Registrar Intercorrência</h2>
          <button onClick={onCancelar} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        <div>
          <label className={labelClass}>Paciente *</label>
          <select
            className={inputClass}
            value={form.paciente_id}
            onChange={e => set('paciente_id', e.target.value)}
          >
            {pacientes.map(p => (
              <option key={p.id} value={p.id}>
                Leito {p.leito} — {p.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Gravidade *</label>
          <div className="flex gap-2">
            {(['leve', 'moderada', 'grave'] as const).map(g => (
              <button
                key={g}
                onClick={() => set('gravidade', g)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition border ${
                  form.gravidade === g
                    ? g === 'leve'
                      ? 'bg-green-500/20 border-green-500/50 text-green-400'
                      : g === 'moderada'
                      ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
                      : 'bg-red-500/20 border-red-500/50 text-red-400'
                    : 'border-slate-600 text-slate-500 hover:border-slate-500'
                }`}
              >
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelClass}>Descrição da intercorrência *</label>
          <textarea
            rows={3}
            className={inputClass}
            value={form.descricao}
            onChange={e => set('descricao', e.target.value)}
            placeholder="O que aconteceu?"
          />
        </div>

        <div>
          <label className={labelClass}>Conduta tomada *</label>
          <textarea
            rows={3}
            className={inputClass}
            value={form.conduta}
            onChange={e => set('conduta', e.target.value)}
            placeholder="O que foi feito?"
          />
        </div>

        <div>
          <label className={labelClass}>Resultado / evolução</label>
          <input
            className={inputClass}
            value={form.resultado || ''}
            onChange={e => set('resultado', e.target.value)}
            placeholder="Como o paciente respondeu?"
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
            onClick={handleSalvar}
            disabled={loading || !form.paciente_id || !form.descricao || !form.conduta}
            className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-lg text-sm font-semibold transition disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  )
}
