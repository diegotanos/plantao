'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function CadastroPage() {
  const supabase = createClient()
  const router = useRouter()
  const [form, setForm] = useState({ nome: '', email: '', senha: '', crm: '', especialidade: '' })
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleCadastro = async () => {
    if (!form.nome || !form.email || !form.senha) {
      setErro('Preencha todos os campos obrigatórios.')
      return
    }
    setLoading(true)
    setErro('')
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.senha,
      options: {
        data: { nome: form.nome, crm: form.crm, especialidade: form.especialidade },
      },
    })
    if (error) setErro(error.message)
    else router.push('/')
    setLoading(false)
  }

  const inputClass = "w-full bg-slate-700 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl p-8 w-full max-w-md shadow-xl border border-slate-700">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🏥</div>
          <h1 className="text-2xl font-bold text-white">Criar conta</h1>
          <p className="text-slate-400 text-sm mt-1">PlantãoApp — Médicos</p>
        </div>
        <div className="space-y-4">
          <input className={inputClass} placeholder="Nome completo *" value={form.nome} onChange={e => set('nome', e.target.value)} />
          <input className={inputClass} type="email" placeholder="E-mail *" value={form.email} onChange={e => set('email', e.target.value)} />
          <input className={inputClass} type="password" placeholder="Senha *" value={form.senha} onChange={e => set('senha', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <input className={inputClass} placeholder="CRM" value={form.crm} onChange={e => set('crm', e.target.value)} />
            <input className={inputClass} placeholder="Especialidade" value={form.especialidade} onChange={e => set('especialidade', e.target.value)} />
          </div>
          {erro && <p className="text-red-400 text-sm">{erro}</p>}
          <button
            onClick={handleCadastro}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg py-3 transition disabled:opacity-50"
          >
            {loading ? 'Criando conta...' : 'Criar conta'}
          </button>
        </div>
        <p className="text-center text-slate-400 text-sm mt-6">
          Já tem conta?{' '}
          <a href="/login" className="text-blue-400 hover:underline">Entrar</a>
        </p>
      </div>
    </div>
  )
}
