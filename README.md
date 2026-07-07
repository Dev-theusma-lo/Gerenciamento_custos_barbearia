# Gerenciamento_custos_barbearia
<br>

### Sobre o sistema: 
Esse sistema foi desenvolvido de forma personalizada, com auxilio de IA, para auxiliar no controle financeiro e de relação com os clientes de uma barbearia real, funcionando no modelo local com o LocalStorage como armazenamento (somente uma pessoa tem acesso), o que quer dizer que as informações ficam salvas no navegador, não permitindo o uso compartilhado das informações. Para a construção foi utilizado HTML, CSS e Javascript e sua biblioteca charts.js para criação de gráficos. O sistema já está em produção!

### Features
O sistema possui as funcionalides de:

Dashboard

- Resumo financeiro do mês (receitas, despesas, lucro)
- Meta de despesas com barra de progresso e alerta visual
- Card de clientes inativos clicável
- Gráfico dos últimos 12 meses
- Últimos lançamentos

Histórico

- Lista de todos os lançamentos financeiros
- Filtros por mês, tipo, categoria e busca por descrição
- Editar e excluir lançamentos

Relatórios

- Gráfico de pizza por categoria
= Comparativo de 6 meses (receitas vs despesas)
= Exportação CSV

Pacotes mensais

- Cadastro de clientes com pacote de serviços
- Controle de usos restantes com barra de progresso
- Encerramento automático com geração de receita
- Renovação de pacote encerrado

Clientes

- Cadastro com nome, telefone, nascimento e data de início
- Abas: Todos e Inativos (configurável em dias)
- Aviso de aniversário no mês
- Aviso de 3 meses sem atendimento (ciclo contínuo)
- Registro de atendimento com checklist de serviços e produtos do estoque
- Histórico de atendimentos com exclusão
- Botão de WhatsApp com mensagem personalizada

Estoque

- Lista de produtos com quantidade e valor de venda
- Dashboard do mês (despesas de compras, receitas de vendas, lucro)
- Cadastro gera despesa automática nos financeiros
- Baixa manual de unidade (−1)
- Botão de detalhes com lucro por produto
- Exclusão de produto remove a despesa vinculada
- Abas: Em estoque e Últimas compras

Configurações

- Nome da barbearia, meta e limite de alerta
- Dias para inatividade e mensagem de retorno WhatsApp
- Serviços precificados (checklist do atendimento)
- Categorias financeiras
- Backup e restauração via JSON

<br>

### Como usar:
O aplicativo WEB no momento está hospedado atualmente na Vercel, com  domínio gratuito - ou, os arquivos estão disponíveis publicamente neste repositório para baixar.

