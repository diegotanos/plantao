'use client'
import { useState } from 'react'
import type { PacienteFormData, TipoPendencia } from '@/lib/types'

interface PacienteFormProps {
  onSalvar: (data: PacienteFormData) => Promise<void>
  onCancelar: () => void
}

export function PacienteForm({ onSalvar, onCancelar }: PacienteFormProps) {
  const [form, setForm] = useState<PacienteFormData>({
    nome: '',
    leito: '',
    diagnostico_principal: '',
    status: 'estavel',
    sbar_situacao: '',
    sbar_background: '',
    sbar_avaliacao: '',
    sbar_recomendacao: '',
    pendencias: [],
  })
  const [novaPendencia, setNovaPendencia] = useState('')
  const [tipoPendencia, setTipoPendencia] = useState<TipoPendencia>('geral')
  const [loading, setLoading] = useState(false)

  const set = (k: keyof PacienteFormData, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const addPendencia = () => {
    if (!novaPendencia.trim()) return
    setForm(f => ({
      ...f,
      pendencias: [...(f.pendencias || []), { descricao: novaPendencia, tipo: tipoPendencia }],
    }))
    setNovaPendencia('')
  }

  const handleSalvar = async () => {
    if (!form.nome || !form.leito || !form.diagnostico_principal) return
    setLoading(true)
    await onSalvar(form)
    setLoading(false)
  }

  const inputClass =
    'w-full bg-slate-700 text-white rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500'
  const labelClass = 'block text-slate-400 text-xs font-medium uppercase tracking-wider mb-1'

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-5 border border-slate-700">
        <div className="flex items-center justify-between">
          <h2 className="text-white text-lg font-bold">Adicionar Paciente</h2>
          <button onClick={onCancelar} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Leito *</label>
            <input
              className={inputClass}
              placeholder="Ex: 12A"
              value={form.leito}
              onChange={e => set('leito', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Idade</label>
            <input
              className={inputClass}
              type="number"
              min={0}
              max={150}
              placeholder="Anos"
              value={form.idade || ''}
              onChange={e => set('idade', e.target.value ? +e.target.value : undefined)}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Nome *</label>
          <input
            className={inputClass}
            placeholder="Nome do paciente"
            value={form.nome}
            onChange={e => set('nome', e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass}>Diagnóstico principal *</label>
          <input
            className={inputClass}
            placeholder="Ex: Pneumonia bacteriana"
            value={form.diagnostico_principal}
            onChange={e => set('diagnostico_principal', e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass}>Status inicial</label>
          <select
            className={inputClass}
            value={form.status}
            onChange={e => set('status', e.target.value)}
          >
            <option value="estavel">🟢 Estável</option>
            <option value="atencao">🟡 Atenção</option>
            <option value="critico">🔴 Crítico</option>
          </select>
        </div>

        {/* SBAR */}
        <div className="space-y-3">
          <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">SBAR (opcional)</p>
          {[
            { key: 'sbar_situacao', label: 'Situação' },
            { key: 'sbar_background', label: 'Background' },
            { key: 'sbar_avaliacao', label: 'Avaliação' },
            { key: 'sbar_recomendacao', label: 'Recomendação' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className={labelClass}>{label}</label>
              <textarea
                rows={2}
                className={inputClass}
                value={(form as unknown as Record<string, string>)[key] || ''}
                onChange={e => set(key as keyof PacienteFormData, e.target.value)}
              />
            </div>
          ))}
        </div>

        {/* Pendências */}
        <div>
          <label className={labelClass}>Pendências</label>
          <div className="flex gap-2">
            <select
              className="bg-slate-700 text-slate-300 rounded-lg px-3 py-2 text-sm outline-none"
              value={tipoPendencia}
              onChange={e => setTipoPendencia(e.target.value as TipoPendencia)}
            >
              <option value="geral">Geral</option>
              <option value="exame">Exame</option>
              <option value="conduta">Conduta</option>
              <option value="retorno">Retorno</option>
              <option value="medicacao">Medicação</option>
            </select>
            <input
              className={`${inputClass} flex-1`}
              placeholder="Descrever pendência"
              value={novaPendencia}
              onChange={e => setNovaPendencia(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addPendencia()}
            />
            <button
              onClick={addPendencia}
              className="bg-slate-600 hover:bg-slate-500 text-white px-3 rounded-lg text-sm"
            >
              +
            </button>
          </div>
          {form.pendencias?.map((pend, i) => (
            <div key={i} className="flex items-center gap-2 mt-2">
              <span className="text-xs bg-slate-700 text-slate-400 px-2 py-1 rounded">{pend.tipo}</span>
              <span className="text-slate-300 text-sm flex-1">{pend.descricao}</span>
              <button
                onClick={() => setForm(f => ({ ...f, pendencias: f.pendencias?.filter((_, j) => j !== i) }))}
                className="text-slate-500 hover:text-red-400 transition"
              >
                ✕
              </button>
            </div>
          ))}
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
            disabled={loading || !form.nome || !form.leito || !form.diagnostico_principal}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg text-sm font-semibold transition disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Salvar Paciente'}
          </button>
        </div>
      </div>
    </div>
  )
}
