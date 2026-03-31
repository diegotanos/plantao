'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePlantao } from '@/lib/hooks/usePlantao'
import type { PlantaoFormData } from '@/lib/types'

export default function NovoPlantaoPage() {
  const router = useRouter()
  const { criarPlantao } = usePlantao()
  const [form, setForm] = useState<PlantaoFormData>({
    setor: '',
    hospital: '',
    observacoes_gerais: '',
  })
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const set = (k: keyof PlantaoFormData, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.setor.trim()) {
      setErro('O setor é obrigatório.')
      return
    }
    setLoading(true)
    setErro('')
    const { data, error } = await criarPlantao(form)
    if (error) {
      setErro(error)
      setLoading(false)
      return
    }
    router.push(`/plantao/${data.id}`)
  }

  const inputClass = "w-full bg-slate-700 text-white rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
  const labelClass = "block text-slate-400 text-xs font-medium uppercase tracking-wider mb-1"

  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Novo Plantão</h1>
        <p className="text-slate-400 text-sm mt-1">Preencha os dados para iniciar o plantão</p>
      </div>

      <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 space-y-5">
        <div>
          <label className={labelClass}>Setor *</label>
          <input
            className={inputClass}
            placeholder="Ex: UTI Adulto, PS, Enfermaria 3"
            value={form.setor}
            onChange={e => set('setor', e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass}>Hospital</label>
          <input
            className={inputClass}
            placeholder="Nome do hospital (opcional)"
            value={form.hospital || ''}
            onChange={e => set('hospital', e.target.value)}
          />
        </div>

        <div>
          <label className={labelClass}>Observações gerais</label>
          <textarea
            rows={3}
            className={inputClass}
            placeholder="Informações gerais do plantão (opcional)"
            value={form.observacoes_gerais || ''}
            onChange={e => set('observacoes_gerais', e.target.value)}
          />
        </div>

        {erro && <p className="text-red-400 text-sm">{erro}</p>}

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => router.back()}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-3 rounded-lg text-sm transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg text-sm font-semibold transition disabled:opacity-50"
          >
            {loading ? 'Iniciando...' : '🚀 Iniciar Plantão'}
          </button>
        </div>
      </div>
    </div>
  )
}
