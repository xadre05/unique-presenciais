export type Turma = {
  id: string; curso_id: string; nome: string; data_inicio: string | null; data_fim: string | null; local: string | null
  vagas: number; status: string; observacoes: string | null; curso_nome: string
  inscritos: number; valor_fechado: number; recebido: number; aguardando_conferencia: number; a_receber: number; atrasado: number
  alunos_atrasados: number; sem_contrato: number
}
export type MatriculaV = {
  id: string; aluno_id: string; turma_id: string; vendedora_id: string | null; data_venda: string; valor_fechado: number
  origem: string; status: string; contrato_assinado: boolean; contrato_arquivo: string | null; motivo_cancelamento: string | null
  observacoes: string | null; aluno_nome: string; aluno_whatsapp: string | null; aluno_email: string | null
  turma_nome: string; data_inicio: string | null; curso_nome: string; vendedora_nome: string | null
  recebido: number; aguardando_conferencia: number; a_receber: number; atrasado: number; parcelas_atrasadas: number
  parcelas_total: number; parcelas_pagas: number; total_programado: number; proximo_vencimento: string | null; situacao_financeira: string
}
export type ParcelaV = {
  id: string; matricula_id: string; numero: number; total_parcelas: number; eh_matricula: boolean; forma: string; conta_id: string | null
  valor: number; vencimento: string | null; status: string; valor_recebido: number | null; data_recebimento: string | null
  comprovante: string | null; hotmart_transacao: string | null; observacao: string | null; informado_por: string | null; confirmado_por: string | null
  situacao: string; dias_atraso: number; turma_id: string; aluno_id: string; vendedora_id: string | null
  aluno_nome: string; aluno_whatsapp: string | null; turma_nome: string; curso_nome: string; conta_nome: string | null; vendedora_nome: string | null
}
export type Opcao = { id: string; nome: string }
export type Conta = Opcao & { tipo: string; ativa: boolean; observacao: string | null }
export type Vendedora = Opcao & { perfil_id: string | null; ativa: boolean }
export type Aluno = {
  id: string; nome: string; email: string | null; whatsapp: string | null; cpf: string | null; rg: string | null; conselho: string | null
  instagram: string | null; cidade: string | null; uf: string | null; tamanho_jaleco: string | null; observacoes: string | null
}
