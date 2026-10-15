import { useAuth } from '../auth'

const PERMISSOES: [string, string, string][] = [
  ['Ver turmas, datas e vagas', 'Sim', 'Sim'],
  ['Ver alunos e pagamentos da equipe (para ajudar e cobrar)', 'Sim (abre em “Minhas vendas”)', 'Sim'],
  ['Ver compradores do online e de quem é a venda', 'Sim, sem valores', 'Sim, com valores'],
  ['Números em dinheiro do painel e das turmas', 'Só das próprias vendas', 'Tudo'],
  ['Fazer nova matrícula', 'Sim (fica no nome dela)', 'Sim (escolhe quem vendeu)'],
  ['Trocar "quem vendeu"', 'Não', 'Sim'],
  ['Informar pagamento (Pix, dinheiro, Hotmart) e anexar comprovante', 'Sim', 'Sim'],
  ['Confirmar que o dinheiro caiu', 'Não', 'Sim'],
  ["Cancelar uma parcela que ainda não foi confirmada", "Sim", "Sim"],
  ['Reabrir parcela cancelada ou confirmada', 'Não', 'Sim'],
  ['Criar ou editar turma e as datas dos módulos', 'Não', 'Sim'],
  ['Copiar links de pagamento', 'Sim', 'Sim'],
  ['Cadastrar ou alterar links de pagamento', 'Não', 'Sim'],
  ['Ver comissão', 'Só a própria', 'Todas'],
  ['Listas de contatos para chamar no WhatsApp', 'Só a parte dela, sem valores pagos', 'Todas, com o andamento de cada vendedora'],
  ['Ver a base inteira de contatos, importar e criar listas', 'Não', 'Sim'],
  ['Liberar e marcar comissão como paga', 'Não', 'Sim'],
  ['Ver histórico de alterações', 'Não', 'Sim'],
  ['Liberar acesso, cadastrar vendedora, curso e conta', 'Não', 'Sim'],
  ['Apagar qualquer coisa', 'Não', 'Não (só cancelar — nada some)'],
]

export default function Ajuda() {
  const { isAdmin } = useAuth()
  return (
    <div className="pagina estreita ajuda">
      <header className="pagina-topo"><div><h1>Como usar</h1><p className="muted">Tudo o que é venda de curso presencial passa por aqui. Planilha não é mais usada.</p></div></header>

      <section className="bloco">
        <h2>A regra de ouro</h2>
        <ul>
          <li><b>Fechou com um aluno? Faz a matrícula na hora.</b> Se não está no sistema, não existe.</li>
          <li><b>Recebeu dinheiro? Informa o pagamento</b> na matrícula do aluno e anexa o comprovante.</li>
          <li>O administrador confere no extrato (Sicoob ou Hotmart) e <b>confirma</b>. Só aí conta como recebido.</li>
          <li>Nada é apagado. Errou? Cancela ou edita — fica registrado quem fez e quando.</li>
        </ul>
      </section>

      <section className="bloco">
        <h2>Fazer uma matrícula</h2>
        <ol>
          <li>Clique em <b>+ Nova matrícula</b> (botão dourado à esquerda).</li>
          <li>Procure o aluno pelo nome. Se for novo, preencha nome, WhatsApp, e-mail e CPF.</li>
          <li>Escolha a turma. {isAdmin ? 'Você escolhe quem vendeu.' : 'O campo "Quem vendeu" já vem com o seu nome.'}</li>
          <li>Monte o pagamento: entrada (matrícula) + parcelas, forma de pagamento e vencimentos. A tabela mostra como vai ficar.</li>
          <li>Se o aluno já pagou a entrada por Pix, anexe o comprovante. Salve.</li>
        </ol>
      </section>

      <section className="bloco">
        <h2>Registrar um pagamento</h2>
        <ol>
          <li>Abra o aluno (em Alunos, Turmas ou Pagamentos).</li>
          <li>Na parcela, clique em <b>Informar pagamento</b>, coloque a data, o valor e anexe o comprovante.</li>
          <li>A parcela fica <b>"aguardando conferência"</b> até o administrador confirmar.</li>
        </ol>
        <p className="muted pequeno">Pix cai na conta Sicoob da Patrícia Regina Academy. Cartão e parcelado vão pela Hotmart da Unique HOF Academy — a Hotmart da Patrícia Regina Academy não é usada para vendas novas.</p>
      </section>

      <section className="bloco">
        <h2>Mandar link de pagamento</h2>
        <p>Em <b>Links de pagamento</b> estão os links oficiais e a chave Pix. Clique em <b>Copiar</b> e cole no WhatsApp do aluno. Não crie link na Hotmart: se precisar de um que não está lá, peça ao administrador.</p>
      </section>

      <section className="bloco">
        <h2>O que cada tela mostra</h2>
        <ul>
          <li><b>Painel</b> — quanto foi fechado, recebido, a receber e atrasado. Listas de quem cobrar hoje e quem vence nos próximos 7 dias.</li>
          <li><b>Agenda</b> — calendário com as datas de todas as turmas e dos módulos da Mini Residência. Dá para pôr cada data na sua agenda do Google com um clique.</li>
          <li><b>Turmas</b> — cada turma com vagas, alunos e situação financeira. Clique para ver os alunos.</li>
          <li><b>Pagamentos</b> — todas as parcelas, com filtros (atrasadas, a vencer, aguardando conferência) e exportação.</li>
          <li><b>Alunos</b> — busca por nome, e-mail ou WhatsApp.</li>
          <li><b>{isAdmin ? 'Listas' : 'Minhas listas'}</b> — contatos para chamar no WhatsApp, com mensagem pronta e o resultado de cada um.</li>
          {isAdmin && <li><b>Contatos</b> — a base inteira (leads, compradores da Hotmart, alunos), com filtros, importação e criação de listas.</li>}
          <li><b>{isAdmin ? 'Comissões' : 'Minhas comissões'}</b> — {isAdmin ? 'comissões de todas as vendedoras: liberar e marcar como paga.' : 'só as suas. R$ 250 por aluno, paga no mês seguinte à inscrição confirmada.'}</li>
          {isAdmin && <li><b>Histórico</b> — tudo que foi criado ou alterado, por quem e quando.</li>}
          {isAdmin && <li><b>Configurações</b> — liberar acesso, ligar login à vendedora, vendedoras, cursos, contas, regras de comissão e Hotmart.</li>}
        </ul>
      </section>

      <section className="bloco">
        <h2>Listas de contatos (WhatsApp)</h2>
        <ol>
          <li>Abra <b>{isAdmin ? 'Listas' : 'Minhas listas'}</b> e entre na lista.</li>
          <li>Na aba <b>A contatar</b>, toque em <b>WhatsApp</b>: abre a conversa no seu WhatsApp com a mensagem pronta, já com o nome da pessoa. Ajuste se quiser e envie.</li>
          <li>Depois marque o que aconteceu: <b>Respondeu</b>, <b>Interessado</b>, <b>Comprou</b>, <b>Não respondeu</b>, <b>Sem interesse</b>, <b>Número errado</b> ou <b>Não quer receber</b>. Use <b>Anotar</b> para guardar o que combinaram e a <b>data</b> para lembrar de retornar (aparece em “Retornar hoje”).</li>
          <li>Se a pessoa comprar depois que entrou na lista, o sistema mostra sozinho “Comprou depois da lista” (pela Hotmart ou pela matrícula).</li>
        </ol>
        <p className="muted pequeno">Mande com calma, sem disparar dezenas iguais em sequência: o WhatsApp bloqueia números que parecem spam. Quem pede para não receber sai de todas as listas novas.</p>
        {isAdmin && <p className="muted pequeno">Para criar uma lista: <b>Contatos</b> → filtre quem você quer chamar (compradores, quem comprou tal produto, quem não comprou tal outro...) → <b>Criar lista com esse filtro</b> → escolha as vendedoras. Os contatos são divididos com a mesma mistura para cada uma.</p>}
      </section>

      <section className="bloco">
        <h2>Comissão</h2>
        <ul>
          <li>R$ 250 fixo por aluno para quem vendeu. Nasce sozinha quando a matrícula é criada.</li>
          <li>É paga no mês seguinte, depois que a inscrição do aluno estiver confirmada. Se só a matrícula foi paga, normalmente espera.</li>
          <li>Matrícula cancelada cancela a comissão (se ainda não foi paga).</li>
          <li>Cada vendedora vê só a própria comissão.</li>
        </ul>
      </section>

      <section className="bloco">
        <h2>Quem pode o quê</h2>
        <div className="tabela-wrap">
          <table className="tabela compacta tabela-permissoes">
            <thead><tr><th>Ação</th><th>Vendedora</th><th>Administrador</th></tr></thead>
            <tbody>{PERMISSOES.map(([a, v, ad]) => <tr key={a}><td>{a}</td><td>{v}</td><td>{ad}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      {isAdmin && (
        <section className="bloco">
          <h2>Para o administrador: liberar alguém novo</h2>
          <ol>
            <li>A pessoa abre o sistema, clica em <b>Criar minha conta</b> e se cadastra com o e-mail dela.</li>
            <li>Você vai em <b>Configurações → Equipe e acessos</b>, clica em <b>Liberar</b> e escolhe <b>Vendedora</b> ou <b>Administrador</b>.</li>
            <li>Se for vendedora, escolha na mesma tela a <b>Vendedora vinculada</b> — é isso que faz a matrícula sair no nome certo e a comissão aparecer para ela.</li>
            <li>Ela clica em "Já liberaram meu acesso — entrar" e pronto.</li>
          </ol>
          <p className="muted pequeno">Alguém saiu da equipe? Em Alterar acesso, escolha <b>Desativado</b>. O histórico dela continua guardado.</p>
        </section>
      )}
    </div>
  )
}
