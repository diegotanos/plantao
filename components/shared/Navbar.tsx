'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useNotificacoes } from '@/lib/hooks/useNotificacoes'
import type { Perfil } from '@/lib/types'

export function Navbar() {
  const supabase = createClient()
  const router = useRouter()
  const { naoLidas, notificacoes, marcarLida } = useNotificacoes()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [showNotificacoes, setShowNotificacoes] = useState(false)

  useEffect(() => {
    const fetchPerfil = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('perfis').select('*').eq('id', user.id).single()
      setPerfil(data)
    }
    fetchPerfil()
  }, [supabase])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="h-14 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between px-4 md:px-6">
      {/* Mobile: Logo */}
      <div className="flex md:hidden items-center gap-2">
        <span className="text-xl">🏥</span>
        <span className="text-white font-bold text-sm">PlantãoApp</span>
      </div>
      <div className="hidden md:block" />

      <div className="flex items-center gap-3">
        {/* Notificações */}
        <div className="relative">
          <button
            onClick={() => setShowNotificacoes(!showNotificacoes)}
            className="relative p-2 text-slate-400 hover:text-white transition"
          >
            🔔
            {naoLidas > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {naoLidas > 9 ? '9+' : naoLidas}
              </span>
            )}
          </button>

          {showNotificacoes && (
            <div className="absolute right-0 top-10 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="p-3 border-b border-slate-700 flex items-center justify-between">
                <p className="text-white text-sm font-semibold">Notificações</p>
                <button
                  onClick={() => setShowNotificacoes(false)}
                  className="text-slate-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notificacoes.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-6">Nenhuma notificação</p>
                ) : (
                  notificacoes.slice(0, 10).map(n => (
                    <div
                      key={n.id}
                      onClick={() => marcarLida(n.id)}
                      className={`p-3 border-b border-slate-700/50 cursor-pointer hover:bg-slate-700/50 transition ${
                        !n.lida ? 'bg-blue-500/5' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.lida && (
                          <span className="w-2 h-2 bg-blue-400 rounded-full mt-1.5 shrink-0" />
                        )}
                        <div className={!n.lida ? '' : 'ml-4'}>
                          <p className="text-white text-xs font-medium">{n.titulo}</p>
                          <p className="text-slate-400 text-xs mt-0.5">{n.mensagem}</p>
                          <p className="text-slate-600 text-xs mt-1">
                            {new Date(n.created_at).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Perfil */}
        {perfil && (
          <div className="flex items-center gap-2">
            <div className="text-right hidden sm:block">
              <p className="text-white text-sm font-medium">{perfil.nome}</p>
              {perfil.crm && <p className="text-slate-500 text-xs">CRM {perfil.crm}</p>}
            </div>
            <button
              onClick={handleLogout}
              className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg text-xs transition"
            >
              Sair
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
