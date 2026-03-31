// ================================================
// TIPOS GLOBAIS — Plantão App
// ================================================

export type StatusPaciente = 'estavel' | 'atencao' | 'critico'
export type StatusPlantao = 'ativo' | 'passagem_pendente' | 'encerrado'
export type GravidadeIntercorrencia = 'leve' | 'moderada' | 'grave'
export type TipoPendencia = 'exame' | 'conduta' | 'retorno' | 'medicacao' | 'geral'
export type TipoNotificacao = 'info' | 'alerta' | 'critico' | 'passagem'

export interface Perfil {
  id: string
  nome: string
  crm?: string
  especialidade?: string
  hospital?: string
  avatar_url?: string
  created_at: string
}

export interface Plantao {
  id: string
  medico_id: string
  medico_recebeu_id?: string
  setor: string
  hospital?: string
  inicio: string
  fim?: string
  status: StatusPlantao
  observacoes_gerais?: string
  confirmado_em?: string
  created_at: string
  // Joins
  medico?: Perfil
  medico_receptor?: Perfil
  pacientes?: Paciente[]
  _count?: { pacientes: number; intercorrencias: number }
}

export interface Paciente {
  id: string
  plantao_id: string
  medico_id: string
  nome: string
  leito: string
  idade?: number
  diagnostico_principal: string
  diagnosticos_secundarios?: string[]
  status: StatusPaciente
  sbar_situacao?: string
  sbar_background?: string
  sbar_avaliacao?: string
  sbar_recomendacao?: string
  created_at: string
  updated_at: string
  // Joins
  pendencias?: Pendencia[]
  intercorrencias?: Intercorrencia[]
}

export interface Pendencia {
  id: string
  paciente_id: string
  plantao_id: string
  descricao: string
  tipo: TipoPendencia
  concluida: boolean
  concluida_em?: string
  created_at: string
}

export interface Intercorrencia {
  id: string
  paciente_id: string
  plantao_id: string
  medico_id: string
  descricao: string
  conduta: string
  resultado?: string
  gravidade: GravidadeIntercorrencia
  horario: string
  created_at: string
  // Joins
  paciente?: Paciente
}

export interface Notificacao {
  id: string
  usuario_id: string
  titulo: string
  mensagem: string
  tipo: TipoNotificacao
  lida: boolean
  plantao_id?: string
  paciente_id?: string
  created_at: string
}

// ================================================
// FORM TYPES
// ================================================

export interface PacienteFormData {
  nome: string
  leito: string
  idade?: number
  diagnostico_principal: string
  diagnosticos_secundarios?: string[]
  status: StatusPaciente
  sbar_situacao?: string
  sbar_background?: string
  sbar_avaliacao?: string
  sbar_recomendacao?: string
  pendencias?: { descricao: string; tipo: TipoPendencia }[]
}

export interface IntercorrenciaFormData {
  paciente_id: string
  descricao: string
  conduta: string
  resultado?: string
  gravidade: GravidadeIntercorrencia
}

export interface PlantaoFormData {
  setor: string
  hospital?: string
  observacoes_gerais?: string
}

export interface PassagemFormData {
  medico_recebeu_id: string
  observacoes_finais?: string
}
