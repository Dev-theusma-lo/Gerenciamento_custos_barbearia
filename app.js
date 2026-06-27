/* ═══════════════════════════════════════════════
   BARBEARIA — GERENCIADOR DE CUSTOS
   Armazenamento: localStorage
   ═══════════════════════════════════════════════ */

const DB = {
  get(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  },
  set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }
};

/* ─── Estado inicial ─── */
function initDefaults() {
  if (!DB.get('config')) {
    DB.set('config', {
      nomeNegocio: 'Minha Barbearia',
      metaMensal: 0,
      alertaLimite: 80,
      diasInatividade: 40,
      mensagemRetorno: 'Olá, {nome}! Sentimos sua falta aqui na [nome da barbearia]. Que tal agendar um horário?',
      categorias: [
        'Produtos', 'Aluguel', 'Energia elétrica', 'Água',
        'Salários', 'Comissões', 'Equipamentos', 'Marketing',
        'Serviços terceiros', 'Manutenção', 'Outros'
      ]
    });
  } else {
    // Migração: garante os novos campos em configs já existentes
    const config = DB.get('config');
    let alterou = false;
    if (config.diasInatividade === undefined) { config.diasInatividade = 40; alterou = true; }
    if (config.mensagemRetorno === undefined) {
      config.mensagemRetorno = 'Olá, {nome}! Sentimos sua falta aqui na [nome da barbearia]. Que tal agendar um horário?';
      alterou = true;
    }
    if (alterou) DB.set('config', config);
  }
  if (!DB.get('lancamentos')) DB.set('lancamentos', []);
  if (!DB.get('resumos_mensais')) DB.set('resumos_mensais', []);
}

/* ─── Utilitários ─── */
function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function formatBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}

function nomeMes(mesAno) {
  if (!mesAno) return '';
  const [y, m] = mesAno.split('-');
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

function nomeMesLong(mesAno) {
  if (!mesAno) return '';
  const [y, m] = mesAno.split('-');
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,6);
}

function showToast(msg, tipo = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast toast-${tipo} show`;
  setTimeout(() => t.classList.remove('show'), 3000);
}

/* ─── Fechamento automático de meses anteriores ─── */
function fecharMesesAnteriores() {
  const lancamentos = DB.get('lancamentos') || [];
  const resumos = DB.get('resumos_mensais') || [];
  const atual = mesAtual();

  const mesesComLancamentos = [...new Set(
    lancamentos.map(l => l.mesAno).filter(m => m < atual)
  )];

  const resumosExistentes = new Set(resumos.map(r => r.mesAno));

  mesesComLancamentos.forEach(mesAno => {
    if (resumosExistentes.has(mesAno)) return;
    const doMes = lancamentos.filter(l => l.mesAno === mesAno);
    const totalReceitas = doMes.filter(l => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0);
    const totalDespesas = doMes.filter(l => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0);
    resumos.push({ mesAno, totalReceitas, totalDespesas, lucroLiquido: totalReceitas - totalDespesas });
  });

  resumos.sort((a, b) => a.mesAno.localeCompare(b.mesAno));
  DB.set('resumos_mensais', resumos);
}

/* ─── Calcular mês atual dinamicamente ─── */
function calcularMesAtual() {
  const lancamentos = DB.get('lancamentos') || [];
  const atual = mesAtual();
  const doMes = lancamentos.filter(l => l.mesAno === atual);
  const totalReceitas = doMes.filter(l => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0);
  const totalDespesas = doMes.filter(l => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0);
  return { totalReceitas, totalDespesas, lucroLiquido: totalReceitas - totalDespesas };
}

/* ─── NAVEGAÇÃO ─── */
function navigate(pageName) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + pageName).classList.add('active');
  document.querySelector(`[data-page="${pageName}"]`).classList.add('active');

  if (pageName === 'dashboard') renderDashboard();
  if (pageName === 'historico') renderHistorico();
  if (pageName === 'relatorios') renderRelatorios();
  if (pageName === 'configuracoes') renderConfiguracoes();
  if (pageName === 'pacotes') renderPacotes();
}

/* ═══════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════ */
function renderDashboard() {
  const config = DB.get('config') || {};
  const { totalReceitas, totalDespesas, lucroLiquido } = calcularMesAtual();
  const atual = mesAtual();

  document.getElementById('dash-mes').textContent = nomeMesLong(atual);
  document.getElementById('dash-receita').textContent = formatBRL(totalReceitas);
  document.getElementById('dash-despesa').textContent = formatBRL(totalDespesas);

  const lucroEl = document.getElementById('dash-lucro');
  lucroEl.textContent = formatBRL(lucroLiquido);
  lucroEl.className = 'stat-value ' + (lucroLiquido >= 0 ? 'positive' : 'negative');

  // Meta e alerta
  const meta = config.metaMensal || 0;
  const alerta = config.alertaLimite || 80;
  const pct = meta > 0 ? Math.min((totalDespesas / meta) * 100, 150) : 0;
  const pctDisplay = meta > 0 ? Math.round((totalDespesas / meta) * 100) : 0;

  const progressFill = document.getElementById('progress-fill');
  const metaPct = document.getElementById('meta-pct');
  const metaStatus = document.getElementById('meta-status');
  const metaValores = document.getElementById('meta-valores');
  const alertBanner = document.getElementById('alert-banner');

  progressFill.style.width = Math.min(pct, 100) + '%';
  metaPct.textContent = meta > 0 ? `${pctDisplay}% do limite` : 'Meta não definida';

  if (meta === 0) {
    progressFill.className = 'progress-fill';
    progressFill.style.width = '0%';
    metaStatus.innerHTML = `<span class="status-dot ok"></span><span style="color:var(--text-muted)">Configure uma meta em Configurações</span>`;
  } else if (pct >= 100) {
    progressFill.className = 'progress-fill over';
    alertBanner.classList.add('visible');
    alertBanner.innerHTML = `⚠️ Limite de despesas ultrapassado — ${formatBRL(totalDespesas)} de ${formatBRL(meta)} permitidos.`;
    metaStatus.innerHTML = `<span class="status-dot over"></span><span style="color:var(--red)">Limite excedido</span>`;
  } else if (pct >= alerta) {
    progressFill.className = 'progress-fill warn';
    alertBanner.classList.remove('visible');
    metaStatus.innerHTML = `<span class="status-dot warn"></span><span style="color:var(--amber)">Atenção: ${pctDisplay}% do limite atingido</span>`;
  } else {
    progressFill.className = 'progress-fill';
    alertBanner.classList.remove('visible');
    metaStatus.innerHTML = `<span class="status-dot ok"></span><span style="color:var(--teal-1)">Dentro do limite</span>`;
  }

  if (meta > 0) {
    metaValores.textContent = `${formatBRL(totalDespesas)} de ${formatBRL(meta)}`;
  }

  // Últimos 5 lançamentos
  const lancamentos = DB.get('lancamentos') || [];
  const ultimos = lancamentos.slice().reverse().slice(0, 5);
  const tbody = document.getElementById('dash-recentes-body');
  if (ultimos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px">Nenhum lançamento ainda</td></tr>`;
  } else {
    tbody.innerHTML = ultimos.map(l => `
      <tr>
        <td>${l.data}</td>
        <td><span class="badge badge-${l.tipo}">${l.tipo}</span></td>
        <td><span class="badge badge-cat">${l.categoria}</span></td>
        <td class="val-${l.tipo}">${l.tipo === 'receita' ? '+' : '-'}${formatBRL(l.valor)}</td>
      </tr>
    `).join('');
  }

  // Card de clientes inativos
  renderCardInativosDashboard();

  // Gráfico 12 meses
  renderChart12Meses();
}

/* ═══════════════════════════════════════════════
   LANÇAMENTOS
   ═══════════════════════════════════════════════ */
let editandoId = null;

function abrirModalLancamento(id = null) {
  editandoId = id;
  const config = DB.get('config') || {};
  const cats = config.categorias || [];
  const modal = document.getElementById('modal-lancamento');
  const titulo = document.getElementById('modal-lanc-titulo');

  // Popular categorias
  const selCat = document.getElementById('lanc-categoria');
  selCat.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');

  if (id) {
    const lancamentos = DB.get('lancamentos') || [];
    const l = lancamentos.find(x => x.id === id);
    if (!l) return;
    titulo.textContent = 'Editar lançamento';
    document.getElementById('lanc-data').value = l.data;
    document.getElementById('lanc-valor').value = l.valor.toFixed(2);
    document.getElementById('lanc-descricao').value = l.descricao || '';
    selCat.value = l.categoria;
    setTipo(l.tipo);
  } else {
    titulo.textContent = 'Novo lançamento';
    document.getElementById('lanc-data').value = new Date().toISOString().split('T')[0];
    document.getElementById('lanc-valor').value = '';
    document.getElementById('lanc-descricao').value = '';
    selCat.value = cats[0] || '';
    setTipo('receita');
  }

  modal.classList.add('open');
}

function fecharModalLancamento() {
  document.getElementById('modal-lancamento').classList.remove('open');
  editandoId = null;
}

let tipoAtual = 'receita';
function setTipo(t) {
  tipoAtual = t;
  document.getElementById('btn-receita').className = 'tipo-btn' + (t === 'receita' ? ' active-receita' : '');
  document.getElementById('btn-despesa').className = 'tipo-btn' + (t === 'despesa' ? ' active-despesa' : '');
}

function salvarLancamento() {
  const data = document.getElementById('lanc-data').value;
  const valorRaw = document.getElementById('lanc-valor').value;
  const categoria = document.getElementById('lanc-categoria').value;
  const descricao = document.getElementById('lanc-descricao').value.trim();

  if (!data || !valorRaw || !categoria) {
    showToast('Preencha data, valor e categoria', 'error');
    return;
  }

  const valor = parseFloat(valorRaw.replace(',', '.'));
  if (isNaN(valor) || valor <= 0) {
    showToast('Valor inválido', 'error');
    return;
  }

  const [y, m] = data.split('-');
  const mesAno = `${y}-${m}`;

  const lancamentos = DB.get('lancamentos') || [];

  if (editandoId) {
    const idx = lancamentos.findIndex(l => l.id === editandoId);
    if (idx !== -1) {
      lancamentos[idx] = { ...lancamentos[idx], data, valor, categoria, descricao, tipo: tipoAtual, mesAno };
    }
    showToast('Lançamento atualizado');
  } else {
    lancamentos.push({ id: gerarId(), data, valor, categoria, descricao, tipo: tipoAtual, mesAno });
    showToast('Lançamento salvo');
  }

  lancamentos.sort((a, b) => a.data.localeCompare(b.data));
  DB.set('lancamentos', lancamentos);
  fecharModalLancamento();

  const paginaAtiva = document.querySelector('.page.active')?.id;
  if (paginaAtiva === 'page-dashboard') renderDashboard();
  if (paginaAtiva === 'page-historico') renderHistorico();
}

function excluirLancamento(id) {
  if (!confirm('Excluir este lançamento?')) return;
  const lancamentos = (DB.get('lancamentos') || []).filter(l => l.id !== id);
  DB.set('lancamentos', lancamentos);
  showToast('Lançamento excluído');
  renderHistorico();
}

/* ═══════════════════════════════════════════════
   HISTÓRICO
   ═══════════════════════════════════════════════ */
function renderHistorico() {
  const lancamentos = DB.get('lancamentos') || [];
  const config = DB.get('config') || {};
  const cats = config.categorias || [];

  // Preencher filtro de meses
  const meses = [...new Set(lancamentos.map(l => l.mesAno))].sort().reverse();
  const selMes = document.getElementById('hist-filtro-mes');
  const valorAtualMes = selMes.value;
  selMes.innerHTML = `<option value="">Todos os meses</option>` +
    meses.map(m => `<option value="${m}">${nomeMesLong(m)}</option>`).join('');
  if (valorAtualMes) selMes.value = valorAtualMes;

  // Preencher filtro de categorias
  const selCat = document.getElementById('hist-filtro-cat');
  const valorAtualCat = selCat.value;
  selCat.innerHTML = `<option value="">Todas as categorias</option>` +
    cats.map(c => `<option value="${c}">${c}</option>`).join('');
  if (valorAtualCat) selCat.value = valorAtualCat;

  aplicarFiltrosHistorico();
}

function aplicarFiltrosHistorico() {
  const lancamentos = DB.get('lancamentos') || [];
  const busca      = (document.getElementById('hist-busca-descricao')?.value || '').toLowerCase().trim();
  const filtroMes  = document.getElementById('hist-filtro-mes').value;
  const filtroTipo = document.getElementById('hist-filtro-tipo').value;
  const filtroCat  = document.getElementById('hist-filtro-cat').value;

  let filtrados = lancamentos.slice().reverse();
  if (busca)      filtrados = filtrados.filter(l => (l.descricao || '').toLowerCase().includes(busca));
  if (filtroMes)  filtrados = filtrados.filter(l => l.mesAno === filtroMes);
  if (filtroTipo) filtrados = filtrados.filter(l => l.tipo === filtroTipo);
  if (filtroCat)  filtrados = filtrados.filter(l => l.categoria === filtroCat);

  const tbody = document.getElementById('hist-tbody');

  if (filtrados.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted)">Nenhum lançamento encontrado</td></tr>`;
    document.getElementById('hist-total-receitas').textContent = formatBRL(0);
    document.getElementById('hist-total-despesas').textContent = formatBRL(0);
    return;
  }

  tbody.innerHTML = filtrados.map(l => `
    <tr>
      <td style="color:var(--text-secondary);font-size:12px">${l.data}</td>
      <td><span class="badge badge-${l.tipo}">${l.tipo}</span></td>
      <td><span class="badge badge-cat">${l.categoria}</span></td>
      <td style="color:var(--text-secondary);font-size:13px">${l.descricao || '—'}</td>
      <td class="val-${l.tipo}" style="text-align:right;white-space:nowrap">
        ${l.tipo === 'receita' ? '+' : '-'}${formatBRL(l.valor)}
      </td>
      <td style="text-align:right;white-space:nowrap">
        <button class="btn btn-secondary btn-sm" onclick="abrirModalLancamento('${l.id}')">Editar</button>
        <button class="btn btn-danger btn-sm" onclick="excluirLancamento('${l.id}')">Excluir</button>
      </td>
    </tr>
  `).join('');

  const totR = filtrados.filter(l => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0);
  const totD = filtrados.filter(l => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0);
  document.getElementById('hist-total-receitas').textContent = formatBRL(totR);
  document.getElementById('hist-total-despesas').textContent = formatBRL(totD);
}

/* ═══════════════════════════════════════════════
   RELATÓRIOS
   ═══════════════════════════════════════════════ */
function renderRelatorios() {
  const lancamentos = DB.get('lancamentos') || [];
  const meses = [...new Set(lancamentos.map(l => l.mesAno))].sort().reverse();

  const sel = document.getElementById('rel-mes');
  const valorAtual = sel.value || mesAtual();
  sel.innerHTML = meses.map(m => `<option value="${m}">${nomeMesLong(m)}</option>`).join('');
  sel.value = meses.includes(valorAtual) ? valorAtual : (meses[0] || '');

  aplicarRelatorio();
}

function aplicarRelatorio() {
  const lancamentos = DB.get('lancamentos') || [];
  const mes = document.getElementById('rel-mes').value;
  if (!mes) return;

  const doMes = lancamentos.filter(l => l.mesAno === mes);
  const receitas = doMes.filter(l => l.tipo === 'receita');
  const despesas = doMes.filter(l => l.tipo === 'despesa');
  const totR = receitas.reduce((s, l) => s + l.valor, 0);
  const totD = despesas.reduce((s, l) => s + l.valor, 0);
  const lucro = totR - totD;

  document.getElementById('rel-stat-receitas').textContent = formatBRL(totR);
  document.getElementById('rel-stat-despesas').textContent = formatBRL(totD);
  const lucroEl = document.getElementById('rel-stat-lucro');
  lucroEl.textContent = formatBRL(lucro);
  lucroEl.className = 'stat-value ' + (lucro >= 0 ? 'positive' : 'negative');

  renderChartPizza(despesas);
  renderChartBarrasMes(lancamentos);
}

function exportarCSV() {
  const lancamentos = DB.get('lancamentos') || [];
  if (lancamentos.length === 0) { showToast('Nenhum dado para exportar', 'error'); return; }
  const header = 'Data,Tipo,Categoria,Descrição,Valor\n';
  const rows = lancamentos.map(l =>
    `${l.data},${l.tipo},${l.categoria},"${(l.descricao||'').replace(/"/g,'""')}",${l.valor.toFixed(2)}`
  ).join('\n');
  download('barbearia-lancamentos.csv', 'text/csv', header + rows);
  showToast('CSV exportado com sucesso');
}

/* ═══════════════════════════════════════════════
   CONFIGURAÇÕES
   ═══════════════════════════════════════════════ */
function renderConfiguracoes() {
  const config = DB.get('config') || {};
  document.getElementById('cfg-nome').value = config.nomeNegocio || '';
  document.getElementById('cfg-meta').value = config.metaMensal || '';
  document.getElementById('cfg-alerta').value = config.alertaLimite || 80;

  renderCatList();
}

function salvarConfig() {
  const config = DB.get('config') || {};
  config.nomeNegocio = document.getElementById('cfg-nome').value.trim() || 'Minha Barbearia';
  config.metaMensal  = parseFloat(document.getElementById('cfg-meta').value) || 0;
  config.alertaLimite = parseFloat(document.getElementById('cfg-alerta').value) || 80;
  DB.set('config', config);

  document.getElementById('sidebar-nome').textContent = config.nomeNegocio;
  showToast('Configurações salvas');
}

function renderCatList() {
  const config = DB.get('config') || {};
  const cats = config.categorias || [];
  const container = document.getElementById('cat-list');
  container.innerHTML = cats.map((c, i) => `
    <span class="cat-chip">
      ${c}
      <button onclick="removerCategoria(${i})" title="Remover">×</button>
    </span>
  `).join('');
}

function adicionarCategoria() {
  const input = document.getElementById('nova-cat');
  const nome = input.value.trim();
  if (!nome) return;
  const config = DB.get('config') || {};
  if (config.categorias.includes(nome)) { showToast('Categoria já existe', 'error'); return; }
  config.categorias.push(nome);
  DB.set('config', config);
  input.value = '';
  renderCatList();
  showToast('Categoria adicionada');
}

function removerCategoria(idx) {
  const config = DB.get('config') || {};
  config.categorias.splice(idx, 1);
  DB.set('config', config);
  renderCatList();
}

/* ─── Backup ─── */
function exportarJSON() {
  const dados = {
    lancamentos: DB.get('lancamentos') || [],
    resumos_mensais: DB.get('resumos_mensais') || [],
    config: DB.get('config') || {},
    dataExportacao: new Date().toISOString(),
    versao: '1.0'
  };
  download(`backup-barbearia-${mesAtual()}.json`, 'application/json', JSON.stringify(dados, null, 2));
  showToast('Backup exportado com sucesso');
}

function importarJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const dados = JSON.parse(ev.target.result);
      if (!dados.lancamentos || !dados.config) throw new Error('Formato inválido');
      if (!confirm(`Importar backup de ${dados.dataExportacao ? new Date(dados.dataExportacao).toLocaleDateString('pt-BR') : 'data desconhecida'}?\n\nIsso vai substituir todos os dados atuais.`)) return;
      DB.set('lancamentos', dados.lancamentos);
      DB.set('resumos_mensais', dados.resumos_mensais || []);
      DB.set('config', dados.config);
      showToast('Backup importado com sucesso');
      renderConfiguracoes();
      fecharMesesAnteriores();
    } catch {
      showToast('Arquivo inválido ou corrompido', 'error');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}

function download(nome, tipo, conteudo) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Init ─── */
window.addEventListener('DOMContentLoaded', () => {
  initDefaults();
  initPacotes();
  initClientes();
  initEstoque();
  fecharMesesAnteriores();

  const config = DB.get('config') || {};
  document.getElementById('sidebar-nome').textContent = config.nomeNegocio || 'Minha Barbearia';

  navigate('dashboard');
});

/* ═══════════════════════════════════════════════
   PACOTES MENSAIS
   ═══════════════════════════════════════════════ */

function initPacotes() {
  if (!DB.get('clientes_pacotes')) DB.set('clientes_pacotes', []);
  // Garantir categoria "Pacote mensal" existe
  const config = DB.get('config') || {};
  if (!config.categorias.includes('Pacote mensal')) {
    config.categorias.push('Pacote mensal');
    DB.set('config', config);
  }
}

/* ─── Render principal da aba ─── */
let pacoteTabAtiva = 'ativos';

function renderPacotes(tab) {
  if (tab) pacoteTabAtiva = tab;

  const todos = DB.get('clientes_pacotes') || [];
  const ativos     = todos.filter(c => c.status === 'ativo');
  const encerrados = todos.filter(c => c.status === 'encerrado');

  // Contadores nas abas
  document.getElementById('tab-count-ativos').textContent     = ativos.length;
  document.getElementById('tab-count-encerrados').textContent = encerrados.length;

  // Highlight aba ativa
  document.getElementById('tab-btn-ativos').className     = 'pacote-tab' + (pacoteTabAtiva === 'ativos' ? ' active' : '');
  document.getElementById('tab-btn-encerrados').className = 'pacote-tab' + (pacoteTabAtiva === 'encerrados' ? ' active' : '');

  const busca = (document.getElementById('pacotes-busca')?.value || '').toLowerCase();
  let lista = pacoteTabAtiva === 'ativos' ? ativos : encerrados;
  if (busca) lista = lista.filter(c => c.nome.toLowerCase().includes(busca) || (c.telefone || '').includes(busca));

  const grid = document.getElementById('pacotes-grid');

  if (lista.length === 0) {
    grid.innerHTML = `
      <div class="pacote-empty">
        <div class="empty-icon">${pacoteTabAtiva === 'ativos' ? '👤' : '📁'}</div>
        <p>${pacoteTabAtiva === 'ativos' ? 'Nenhum cliente ativo' : 'Nenhum pacote encerrado'}</p>
      </div>`;
    return;
  }

  grid.innerHTML = lista.map(c => renderCardPacote(c)).join('');
}

function renderCardPacote(c) {
  const usosFeitos   = c.usos ? c.usos.length : 0;
  const usosTotal    = c.usosTotal || 1;
  const usosRestantes = usosTotal - usosFeitos;
  const pct          = Math.min((usosFeitos / usosTotal) * 100, 100);
  const fillClass    = pct >= 100 ? 'cheio' : pct >= 75 ? 'quase' : '';

  const botoesAtivo = `
    <button class="btn btn-primary btn-sm" onclick="registrarUso('${c.id}')">✓ Registrar uso</button>
    <button class="btn btn-secondary btn-sm" onclick="abrirModalUsos('${c.id}')">📅 Histórico</button>
    <button class="btn btn-secondary btn-sm" onclick="abrirModalPacote('${c.id}')">✏️</button>`;

  const botoesEncerrado = `
    <button class="btn btn-secondary btn-sm" onclick="abrirModalUsos('${c.id}')">📅 Histórico</button>
    <button class="btn btn-primary btn-sm" onclick="renovarPacote('${c.id}')">↺ Renovar</button>`;

  return `
    <div class="pacote-card ${c.status}">
      <div class="pacote-card-header">
        <div>
          <div class="pacote-nome">${c.nome}</div>
          <div class="pacote-tel">${c.telefone || '—'}</div>
        </div>
        <span class="badge badge-${c.status === 'ativo' ? 'ativo' : 'encerrado'}">
          ${c.status === 'ativo' ? 'Ativo' : 'Encerrado'}
        </span>
      </div>
      <div class="pacote-servico">✂️ ${c.servico}</div>
      <div class="pacote-valor">${formatBRL(c.valor)}</div>
      <div class="usos-label">
        <span>${usosFeitos} de ${usosTotal} usos</span>
        <span>${c.status === 'ativo' ? usosRestantes + ' restantes' : 'Concluído'}</span>
      </div>
      <div class="usos-bar">
        <div class="usos-fill ${fillClass}" style="width:${pct}%"></div>
      </div>
      <div class="pacote-actions">
        ${c.status === 'ativo' ? botoesAtivo : botoesEncerrado}
      </div>
    </div>`;
}

/* ─── Registrar uso rápido ─── */
function registrarUso(id) {
  const clientes = DB.get('clientes_pacotes') || [];
  const idx = clientes.findIndex(c => c.id === id);
  if (idx === -1) return;
  const c = clientes[idx];

  const hoje = new Date().toISOString().split('T')[0];
  c.usos = c.usos || [];
  c.usos.push({ id: gerarId(), data: hoje });

  // Verificar se esgotou
  if (c.usos.length >= c.usosTotal) {
    c.status = 'encerrado';
    gerarReceitaPacote(c);
    showToast(`Pacote de ${c.nome} encerrado! Receita gerada.`);
  } else {
    showToast(`Uso registrado — ${c.usosTotal - c.usos.length} restantes`);
  }

  DB.set('clientes_pacotes', clientes);
  renderPacotes();
}

/* ─── Gerar receita automática ao encerrar ─── */
function gerarReceitaPacote(cliente) {
  const lancamentos = DB.get('lancamentos') || [];
  const hoje = new Date().toISOString().split('T')[0];
  const [y, m] = hoje.split('-');
  lancamentos.push({
    id: gerarId(),
    data: hoje,
    tipo: 'receita',
    categoria: 'Pacote mensal',
    valor: cliente.valor,
    descricao: `Pacote: ${cliente.nome} — ${cliente.servico}`,
    mesAno: `${y}-${m}`
  });
  lancamentos.sort((a, b) => a.data.localeCompare(b.data));
  DB.set('lancamentos', lancamentos);
}

/* ─── Modal: Novo / Editar pacote ─── */
let editandoPacoteId = null;

function abrirModalPacote(id = null) {
  editandoPacoteId = id;
  const modal = document.getElementById('modal-pacote');
  document.getElementById('modal-pacote-titulo').textContent = id ? 'Editar cliente' : 'Novo cliente';

  if (id) {
    const clientes = DB.get('clientes_pacotes') || [];
    const c = clientes.find(x => x.id === id);
    if (!c) return;
    document.getElementById('pac-nome').value     = c.nome;
    document.getElementById('pac-tel').value      = c.telefone || '';
    document.getElementById('pac-servico').value  = c.servico;
    document.getElementById('pac-valor').value    = c.valor.toFixed(2);
    document.getElementById('pac-usos').value     = c.usosTotal;
    document.getElementById('pac-inicio').value   = c.dataInicio || '';
  } else {
    document.getElementById('pac-nome').value     = '';
    document.getElementById('pac-tel').value      = '';
    document.getElementById('pac-servico').value  = '';
    document.getElementById('pac-valor').value    = '';
    document.getElementById('pac-usos').value     = '';
    document.getElementById('pac-inicio').value   = new Date().toISOString().split('T')[0];
  }

  modal.classList.add('open');
}

function fecharModalPacote() {
  document.getElementById('modal-pacote').classList.remove('open');
  editandoPacoteId = null;
}

function salvarPacote() {
  const nome    = document.getElementById('pac-nome').value.trim();
  const tel     = document.getElementById('pac-tel').value.trim();
  const servico = document.getElementById('pac-servico').value.trim();
  const valor   = parseFloat(document.getElementById('pac-valor').value.replace(',', '.'));
  const usos    = parseInt(document.getElementById('pac-usos').value);
  const inicio  = document.getElementById('pac-inicio').value;

  if (!nome || !servico || isNaN(valor) || valor <= 0 || isNaN(usos) || usos < 1) {
    showToast('Preencha todos os campos obrigatórios', 'error');
    return;
  }

  const clientes = DB.get('clientes_pacotes') || [];

  if (editandoPacoteId) {
    const idx = clientes.findIndex(c => c.id === editandoPacoteId);
    if (idx !== -1) {
      clientes[idx] = { ...clientes[idx], nome, telefone: tel, servico, valor, usosTotal: usos, dataInicio: inicio };
    }
    showToast('Cliente atualizado');
  } else {
    clientes.push({
      id: gerarId(),
      nome, telefone: tel, servico, valor,
      usosTotal: usos,
      dataInicio: inicio,
      status: 'ativo',
      usos: []
    });
    showToast('Cliente cadastrado');
  }

  DB.set('clientes_pacotes', clientes);
  fecharModalPacote();
  renderPacotes();
}

/* ─── Modal: Histórico de usos ─── */
let modalUsosClienteId = null;

function abrirModalUsos(id) {
  modalUsosClienteId = id;
  const clientes = DB.get('clientes_pacotes') || [];
  const c = clientes.find(x => x.id === id);
  if (!c) return;

  document.getElementById('modal-usos-titulo').textContent = `Histórico — ${c.nome}`;
  document.getElementById('modal-usos-info').textContent   =
    `${c.servico} · ${c.usos?.length || 0} de ${c.usosTotal} usos · ${formatBRL(c.valor)}`;

  renderListaUsos(c);
  document.getElementById('modal-usos').classList.add('open');
}

function fecharModalUsos() {
  document.getElementById('modal-usos').classList.remove('open');
  modalUsosClienteId = null;
}

function renderListaUsos(c) {
  const lista = document.getElementById('usos-lista');
  const usos  = (c.usos || []).slice().sort((a, b) => b.data.localeCompare(a.data));

  if (usos.length === 0) {
    lista.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">Nenhum uso registrado</div>`;
    return;
  }

  lista.innerHTML = usos.map((u, i) => `
    <div class="uso-item">
      <span>📅 ${formatDataBR(u.data)}</span>
      ${c.status === 'ativo' ? `<button onclick="removerUso('${u.id}')" title="Remover">×</button>` : ''}
    </div>`).join('');
}

function formatDataBR(data) {
  if (!data) return '—';
  const [y, m, d] = data.split('-');
  return `${d}/${m}/${y}`;
}

function adicionarUsoManual() {
  const input = document.getElementById('add-uso-data');
  const data  = input.value;
  if (!data) { showToast('Selecione uma data', 'error'); return; }

  const clientes = DB.get('clientes_pacotes') || [];
  const idx = clientes.findIndex(c => c.id === modalUsosClienteId);
  if (idx === -1) return;
  const c = clientes[idx];

  c.usos = c.usos || [];
  c.usos.push({ id: gerarId(), data });
  c.usos.sort((a, b) => a.data.localeCompare(b.data));

  if (c.usos.length >= c.usosTotal && c.status === 'ativo') {
    c.status = 'encerrado';
    gerarReceitaPacote(c);
    showToast(`Pacote encerrado! Receita gerada.`);
  } else {
    showToast('Data adicionada');
  }

  DB.set('clientes_pacotes', clientes);
  renderListaUsos(c);
  renderPacotes();
  input.value = '';
}

function removerUso(usoId) {
  if (!confirm('Remover este uso?')) return;
  const clientes = DB.get('clientes_pacotes') || [];
  const idx = clientes.findIndex(c => c.id === modalUsosClienteId);
  if (idx === -1) return;
  const c = clientes[idx];
  c.usos = (c.usos || []).filter(u => u.id !== usoId);
  DB.set('clientes_pacotes', clientes);
  renderListaUsos(c);
  renderPacotes();
  showToast('Uso removido');
}

/* ─── Renovar pacote encerrado ─── */
function renovarPacote(id) {
  const clientes = DB.get('clientes_pacotes') || [];
  const c = clientes.find(x => x.id === id);
  if (!c) return;

  // Pré-preenche modal com dados do cliente mas reseta usos
  editandoPacoteId = null;
  document.getElementById('modal-pacote-titulo').textContent = 'Renovar pacote';
  document.getElementById('pac-nome').value     = c.nome;
  document.getElementById('pac-tel').value      = c.telefone || '';
  document.getElementById('pac-servico').value  = c.servico;
  document.getElementById('pac-valor').value    = c.valor.toFixed(2);
  document.getElementById('pac-usos').value     = c.usosTotal;
  document.getElementById('pac-inicio').value   = new Date().toISOString().split('T')[0];

  document.getElementById('modal-pacote').classList.add('open');
}

/* ─── Exportar / Importar: incluir pacotes no backup ─── */
const _exportarJSONOriginal = exportarJSON;
exportarJSON = function() {
  const dados = {
    lancamentos:      DB.get('lancamentos') || [],
    resumos_mensais:  DB.get('resumos_mensais') || [],
    config:           DB.get('config') || {},
    clientes_pacotes: DB.get('clientes_pacotes') || [],
    dataExportacao:   new Date().toISOString(),
    versao: '1.1'
  };
  download(`backup-barbearia-${mesAtual()}.json`, 'application/json', JSON.stringify(dados, null, 2));
  showToast('Backup exportado com sucesso');
};

const _importarJSONOriginal = importarJSON;
importarJSON = function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const dados = JSON.parse(ev.target.result);
      if (!dados.lancamentos || !dados.config) throw new Error('Formato inválido');
      if (!confirm(`Importar backup de ${dados.dataExportacao ? new Date(dados.dataExportacao).toLocaleDateString('pt-BR') : 'data desconhecida'}?\n\nIsso vai substituir todos os dados atuais.`)) return;
      DB.set('lancamentos',      dados.lancamentos);
      DB.set('resumos_mensais',  dados.resumos_mensais || []);
      DB.set('config',           dados.config);
      DB.set('clientes_pacotes', dados.clientes_pacotes || []);
      showToast('Backup importado com sucesso');
      renderConfiguracoes();
      fecharMesesAnteriores();
    } catch {
      showToast('Arquivo inválido ou corrompido', 'error');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
};

/* ═══════════════════════════════════════════════
   CLIENTES — CADASTRO E ATENDIMENTOS
   ═══════════════════════════════════════════════ */

function initClientes() {
  if (!DB.get('clientes_atendimento')) DB.set('clientes_atendimento', []);
  if (!DB.get('servicos_precos')) {
    DB.set('servicos_precos', [
      { id: gerarId(), nome: 'Corte', valor: 35 },
      { id: gerarId(), nome: 'Barba', valor: 25 },
      { id: gerarId(), nome: 'Sobrancelha', valor: 15 },
    ]);
  }
  const config = DB.get('config') || {};
  if (config.categorias && !config.categorias.includes('Atendimento')) {
    config.categorias.push('Atendimento');
    DB.set('config', config);
  }
}

/* ─── Render principal da aba ─── */
let clienteTabAtiva = 'todos';

function renderClientes(tab) {
  if (tab) clienteTabAtiva = tab;

  const clientes = DB.get('clientes_atendimento') || [];
  const inativos = clientes.filter(c => isClienteInativo(c));

  // Contadores nas abas
  const elTodos = document.getElementById('tab-count-clientes-todos');
  const elInativos = document.getElementById('tab-count-clientes-inativos');
  if (elTodos) elTodos.textContent = clientes.length;
  if (elInativos) elInativos.textContent = inativos.length;

  // Highlight aba ativa
  const btnTodos = document.getElementById('tab-btn-clientes-todos');
  const btnInativos = document.getElementById('tab-btn-clientes-inativos');
  if (btnTodos) btnTodos.className = 'cliente-tab' + (clienteTabAtiva === 'todos' ? ' active' : '');
  if (btnInativos) btnInativos.className = 'cliente-tab' + (clienteTabAtiva === 'inativos' ? ' active' : '');

  const busca = (document.getElementById('clientes-busca')?.value || '').toLowerCase();
  let lista = clienteTabAtiva === 'inativos' ? inativos.slice() : clientes.slice();

  if (busca) {
    lista = lista.filter(c =>
      c.nome.toLowerCase().includes(busca) || (c.telefone || '').includes(busca)
    );
  }
  lista.sort((a, b) => a.nome.localeCompare(b.nome));

  const grid = document.getElementById('clientes-grid');

  if (lista.length === 0) {
    const msgVazioInativo = 'Nenhum cliente inativo — ótimo sinal!';
    const msgVazioTodos = clientes.length === 0 ? 'Nenhum cliente cadastrado ainda' : 'Nenhum cliente encontrado';
    grid.innerHTML = `
      <div class="cliente-empty">
        <div class="empty-icon">${clienteTabAtiva === 'inativos' ? '✅' : '👤'}</div>
        <p>${clienteTabAtiva === 'inativos' ? msgVazioInativo : msgVazioTodos}</p>
      </div>`;
    return;
  }

  grid.innerHTML = lista.map(c => renderCardCliente(c)).join('');
}

/* ─── Cálculo de inatividade ─── */
function getUltimoAtendimento(c) {
  const atendimentos = c.atendimentos || [];
  if (atendimentos.length === 0) return null;
  return atendimentos.slice().sort((a, b) => b.data.localeCompare(a.data))[0].data;
}

function getDiasParado(c) {
  const ultimo = getUltimoAtendimento(c);
  const referencia = ultimo || c.clienteDesde;
  if (!referencia) return 0;
  const dataRef = new Date(referencia);
  const hoje = new Date();
  return Math.floor((hoje - dataRef) / (1000 * 60 * 60 * 24));
}

function getDiasInatividadeConfig() {
  const config = DB.get('config') || {};
  return config.diasInatividade || 40;
}

function isClienteInativo(c) {
  return getDiasParado(c) >= getDiasInatividadeConfig();
}

function contarClientesInativos() {
  const clientes = DB.get('clientes_atendimento') || [];
  return clientes.filter(c => isClienteInativo(c)).length;
}

/* ─── WhatsApp ─── */
function formatarTelefoneWhatsApp(telefone) {
  let limpo = (telefone || '').replace(/\D/g, '');
  if (!limpo) return '';
  if (!limpo.startsWith('55')) limpo = '55' + limpo;
  return limpo;
}

function montarMensagemWhatsApp(nomeCliente) {
  const config = DB.get('config') || {};
  let msg = config.mensagemRetorno ||
    'Olá, {nome}! Sentimos sua falta aqui na [nome da barbearia]. Que tal agendar um horário?';
  msg = msg.replace(/\{nome\}/g, nomeCliente);
  msg = msg.replace(/\[nome da barbearia\]/g, config.nomeNegocio || 'nossa barbearia');
  return msg;
}

function abrirWhatsApp(telefone, nomeCliente) {
  const numero = formatarTelefoneWhatsApp(telefone);
  if (!numero) {
    showToast('Cliente sem telefone cadastrado', 'error');
    return;
  }
  const mensagem = encodeURIComponent(montarMensagemWhatsApp(nomeCliente));
  window.open(`https://wa.me/${numero}?text=${mensagem}`, '_blank');
}

function renderCardCliente(c) {
  const isAniversario = checarMesAniversario(c.nascimento);
  const inativo = isClienteInativo(c);
  const atendimentos = c.atendimentos || [];
  const totalAtendimentos = atendimentos.length;
  const clienteDesde = formatDataBR(c.clienteDesde);
  const nascimentoFmt = c.nascimento ? formatDataBR(c.nascimento) : '—';
  const ultimo = getUltimoAtendimento(c);
  const diasParado = getDiasParado(c);

  const cardClass = inativo ? 'inativo' : (isAniversario ? 'aniversario' : '');
  const nomeEscapado = c.nome.replace(/'/g, "\\'");

  let badges = '';
  if (isAniversario) badges += '<span class="cliente-badge-aniv">🎂 Aniversário</span>';
  if (inativo) badges += `<span class="cliente-badge-inativo">⏰ ${diasParado}d parado</span>`;

  const metaInativo = inativo ? `
      <div class="cliente-meta-row"><span>Último atendimento</span><strong>${ultimo ? formatDataBR(ultimo) : 'Nunca atendido'}</strong></div>` : '';

  return `
    <div class="cliente-card ${cardClass}">
      <div class="cliente-card-header">
        <div>
          <div class="cliente-nome">${c.nome}</div>
          <div class="cliente-tel">${c.telefone || '—'}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">${badges}</div>
      </div>
      <div class="cliente-meta">
        <div class="cliente-meta-row"><span>Nascimento</span><strong>${nascimentoFmt}</strong></div>
        <div class="cliente-meta-row"><span>Cliente desde</span><strong>${clienteDesde}</strong></div>
        <div class="cliente-meta-row"><span>Atendimentos</span><strong>${totalAtendimentos}</strong></div>
        ${metaInativo}
      </div>
      <div class="cliente-actions">
        <button class="btn btn-primary btn-sm" onclick="abrirModalAtendimento('${c.id}')">+ Atendimento</button>
        <button class="btn btn-secondary btn-sm" onclick="abrirModalHistoricoCliente('${c.id}')">📋 Histórico</button>
        <button class="btn btn-secondary btn-sm" onclick="abrirModalCliente('${c.id}')">✏️</button>
        <button class="btn btn-whatsapp btn-sm" onclick="abrirWhatsApp('${c.telefone || ''}', '${nomeEscapado}')">WhatsApp</button>
      </div>
    </div>`;
}

/* ─── Verificações de aviso ─── */
function checarMesAniversario(nascimento) {
  if (!nascimento) return false;
  const mesNasc = parseInt(nascimento.split('-')[1]);
  const mesAtualNum = new Date().getMonth() + 1;
  return mesNasc === mesAtualNum;
}

function checarTresMeses(marcoTresMeses) {
  if (!marcoTresMeses) return false;
  const marco = new Date(marcoTresMeses);
  const hoje = new Date();
  const diffDias = (hoje - marco) / (1000 * 60 * 60 * 24);
  return diffDias >= 90;
}

/* ─── Modal: Novo / Editar cliente ─── */
let editandoClienteId = null;

function abrirModalCliente(id = null) {
  editandoClienteId = id;
  document.getElementById('modal-cliente-titulo').textContent = id ? 'Editar cliente' : 'Novo cliente';

  if (id) {
    const clientes = DB.get('clientes_atendimento') || [];
    const c = clientes.find(x => x.id === id);
    if (!c) return;
    document.getElementById('cli-nome').value = c.nome;
    document.getElementById('cli-tel').value = c.telefone || '';
    document.getElementById('cli-nascimento').value = c.nascimento || '';
    document.getElementById('cli-desde').value = c.clienteDesde || '';
  } else {
    document.getElementById('cli-nome').value = '';
    document.getElementById('cli-tel').value = '';
    document.getElementById('cli-nascimento').value = '';
    document.getElementById('cli-desde').value = new Date().toISOString().split('T')[0];
  }

  document.getElementById('modal-cliente').classList.add('open');
}

function fecharModalCliente() {
  document.getElementById('modal-cliente').classList.remove('open');
  editandoClienteId = null;
}

function salvarCliente() {
  const nome = document.getElementById('cli-nome').value.trim();
  const tel = document.getElementById('cli-tel').value.trim();
  const nascimento = document.getElementById('cli-nascimento').value;
  const desde = document.getElementById('cli-desde').value;

  if (!nome) {
    showToast('Informe o nome do cliente', 'error');
    return;
  }

  const clientes = DB.get('clientes_atendimento') || [];
  const isNovo = !editandoClienteId;
  let novoClienteId = null;

  if (editandoClienteId) {
    const idx = clientes.findIndex(c => c.id === editandoClienteId);
    if (idx !== -1) {
      clientes[idx] = { ...clientes[idx], nome, telefone: tel, nascimento, clienteDesde: desde };
    }
    showToast('Cliente atualizado');
  } else {
    novoClienteId = gerarId();
    const dataCadastro = desde || new Date().toISOString().split('T')[0];
    clientes.push({
      id: novoClienteId,
      nome, telefone: tel, nascimento,
      clienteDesde: dataCadastro,
      marcoTresMeses: dataCadastro,
      atendimentos: []
    });
    showToast('Cliente cadastrado');
  }

  DB.set('clientes_atendimento', clientes);
  fecharModalCliente();
  renderClientes();

  if (isNovo && novoClienteId) {
    abrirModalAtendimento(novoClienteId);
  }
}

/* ─── Modal: Registrar atendimento ─── */
let atendimentoClienteId = null;
let servicosSelecionados = {};
let produtosEstoqueSelecionados = []; // [{ produtoId, nome, qtd, qtdDisponivel, valorUnitario }]
let avisoTresMesesAtivoNesteAtendimento = false;

function abrirModalAtendimento(clienteId) {
  atendimentoClienteId = clienteId;
  servicosSelecionados = {};
  produtosEstoqueSelecionados = [];

  const clientes = DB.get('clientes_atendimento') || [];
  const c = clientes.find(x => x.id === clienteId);
  if (!c) return;

  document.getElementById('atend-cliente-nome-tel').innerHTML =
    `<strong>${c.nome}</strong> · ${c.telefone || 'sem telefone'}`;
  document.getElementById('atend-data').value = new Date().toISOString().split('T')[0];

  // Avisos
  const marco = c.marcoTresMeses || c.clienteDesde; // fallback para clientes cadastrados antes desta feature
  avisoTresMesesAtivoNesteAtendimento = checarTresMeses(marco);

  const avisosEl = document.getElementById('atend-avisos');
  let avisosHtml = '';
  if (avisoTresMesesAtivoNesteAtendimento) {
    avisosHtml += `<div class="aviso-banner aviso-tres-meses">⭐ ${c.nome} completou 3 meses sem atendimento!</div>`;
  }
  if (checarMesAniversario(c.nascimento)) {
    avisosHtml += `<div class="aviso-banner aviso-aniversario">🎂 Aniversário de ${c.nome} é neste mês — considere uma cortesia</div>`;
  }
  avisosEl.innerHTML = avisosHtml;

  renderServicosChecklist();
  renderSelectProdutosEstoque();
  renderProdutosEstoqueLista();
  atualizarTotalAtendimento();

  document.getElementById('modal-atendimento').classList.add('open');
}

function fecharModalAtendimento() {
  document.getElementById('modal-atendimento').classList.remove('open');
  atendimentoClienteId = null;
  servicosSelecionados = {};
  produtosEstoqueSelecionados = [];
  avisoTresMesesAtivoNesteAtendimento = false;
}

function renderServicosChecklist() {
  const servicos = DB.get('servicos_precos') || [];
  const container = document.getElementById('servicos-checklist');

  if (servicos.length === 0) {
    container.innerHTML = `<div class="servicos-empty">Nenhum serviço cadastrado. Adicione em Configurações.</div>`;
    return;
  }

  container.innerHTML = servicos.map(s => `
    <label class="servico-check-item ${servicosSelecionados[s.id] ? 'checked' : ''}" id="servico-item-${s.id}">
      <span class="servico-check-left">
        <input type="checkbox" ${servicosSelecionados[s.id] ? 'checked' : ''}
          onchange="toggleServico('${s.id}', '${s.nome.replace(/'/g, "\\'")}', ${s.valor})">
        <span>${s.nome}</span>
      </span>
      <span class="servico-check-valor">${formatBRL(s.valor)}</span>
    </label>
  `).join('');
}

function toggleServico(id, nome, valor) {
  if (servicosSelecionados[id]) {
    delete servicosSelecionados[id];
  } else {
    servicosSelecionados[id] = { nome, valor };
  }
  document.getElementById(`servico-item-${id}`).classList.toggle('checked');
  atualizarTotalAtendimento();
}

/* ─── Produtos do estoque dentro do atendimento ─── */
function renderSelectProdutosEstoque() {
  const select = document.getElementById('atend-select-produto-estoque');
  const produtos = (DB.get('estoque_produtos') || []).filter(p => p.qtdRestante > 0);
  const jaSelecionados = new Set(produtosEstoqueSelecionados.map(p => p.produtoId));
  const disponiveis = produtos.filter(p => !jaSelecionados.has(p.id));

  if (disponiveis.length === 0) {
    select.innerHTML = `<option value="">Nenhum produto disponível</option>`;
    return;
  }
  select.innerHTML = `<option value="">Selecione um produto...</option>` +
    disponiveis.map(p => `<option value="${p.id}">${p.nome} (${p.qtdRestante} disp.)</option>`).join('');
}

function adicionarProdutoEstoqueAtendimento() {
  const select = document.getElementById('atend-select-produto-estoque');
  const produtoId = select.value;
  if (!produtoId) return;

  const produtos = DB.get('estoque_produtos') || [];
  const p = produtos.find(x => x.id === produtoId);
  if (!p || p.qtdRestante <= 0) return;

  produtosEstoqueSelecionados.push({
    produtoId: p.id,
    nome: p.nome,
    qtd: 1,
    qtdDisponivel: p.qtdRestante,
    valorUnitario: p.valorVenda || 0
  });

  renderSelectProdutosEstoque();
  renderProdutosEstoqueLista();
  atualizarTotalAtendimento();
}

function renderProdutosEstoqueLista() {
  const container = document.getElementById('produtos-estoque-lista');
  if (produtosEstoqueSelecionados.length === 0) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = produtosEstoqueSelecionados.map((item, idx) => `
    <div class="produto-estoque-item">
      <div>
        <div class="pe-nome">${item.nome}</div>
        <div class="pe-disponivel">${item.qtdDisponivel} disponíveis</div>
      </div>
      <input type="number" min="1" max="${item.qtdDisponivel}" value="${item.qtd}"
        oninput="atualizarQtdProdutoEstoque(${idx}, this.value)">
      <input type="number" min="0" step="0.01" value="${item.valorUnitario}"
        oninput="atualizarValorProdutoEstoque(${idx}, this.value)">
      <button onclick="removerProdutoEstoqueAtendimento(${idx})" title="Remover">×</button>
    </div>
  `).join('');
}

function atualizarQtdProdutoEstoque(idx, valor) {
  const item = produtosEstoqueSelecionados[idx];
  if (!item) return;
  let qtd = parseInt(valor);
  if (isNaN(qtd) || qtd < 1) qtd = 1;
  if (qtd > item.qtdDisponivel) {
    qtd = item.qtdDisponivel;
    showToast(`Apenas ${item.qtdDisponivel} unidades disponíveis`, 'error');
  }
  item.qtd = qtd;
  renderProdutosEstoqueLista();
  atualizarTotalAtendimento();
}

function atualizarValorProdutoEstoque(idx, valor) {
  const item = produtosEstoqueSelecionados[idx];
  if (!item) return;
  item.valorUnitario = parseFloat(valor) || 0;
  atualizarTotalAtendimento();
}

function removerProdutoEstoqueAtendimento(idx) {
  produtosEstoqueSelecionados.splice(idx, 1);
  renderSelectProdutosEstoque();
  renderProdutosEstoqueLista();
  atualizarTotalAtendimento();
}

function atualizarTotalAtendimento() {
  const totalServicos = Object.values(servicosSelecionados).reduce((s, v) => s + v.valor, 0);
  const totalProdutosEstoque = produtosEstoqueSelecionados.reduce((s, p) => s + (p.qtd * p.valorUnitario), 0);
  const total = totalServicos + totalProdutosEstoque;
  document.getElementById('atend-total-valor').textContent = formatBRL(total);
}

function salvarAtendimento() {
  const data = document.getElementById('atend-data').value;

  if (!data) {
    showToast('Selecione a data do atendimento', 'error');
    return;
  }

  const servicosArr = Object.values(servicosSelecionados);
  const produtosEstoqueArr = produtosEstoqueSelecionados.slice();

  if (servicosArr.length === 0 && produtosEstoqueArr.length === 0) {
    showToast('Selecione ao menos um serviço ou produto', 'error');
    return;
  }

  const totalServicos = servicosArr.reduce((s, v) => s + v.valor, 0);
  const totalProdutosEstoque = produtosEstoqueArr.reduce((s, p) => s + (p.qtd * p.valorUnitario), 0);
  const total = totalServicos + totalProdutosEstoque;

  const clientes = DB.get('clientes_atendimento') || [];
  const idx = clientes.findIndex(c => c.id === atendimentoClienteId);
  if (idx === -1) return;

  // Dar baixa nos produtos do estoque usados
  const estoqueProdutos = DB.get('estoque_produtos') || [];
  produtosEstoqueArr.forEach(item => {
    const p = estoqueProdutos.find(x => x.id === item.produtoId);
    if (!p) return;
    p.qtdRestante = Math.max(0, p.qtdRestante - item.qtd);
    if (p.qtdRestante <= 0) {
      showToast(`${p.nome} esgotado — movido para Últimas compras`);
    }
  });
  DB.set('estoque_produtos', estoqueProdutos);

  const registro = {
    id: gerarId(),
    data,
    servicos: servicosArr,
    produtosEstoque: produtosEstoqueArr.map(p => ({ nome: p.nome, qtd: p.qtd, valorUnitario: p.valorUnitario })),
    total,
    lancamentoId: null
  };

  clientes[idx].atendimentos = clientes[idx].atendimentos || [];
  clientes[idx].atendimentos.push(registro);
  clientes[idx].atendimentos.sort((a, b) => a.data.localeCompare(b.data));

  // Se o aviso de 3 meses estava ativo quando este atendimento foi aberto,
  // este atendimento se torna o novo marco de referência para a próxima contagem
  if (avisoTresMesesAtivoNesteAtendimento) {
    clientes[idx].marcoTresMeses = data;
  }

  // Gerar receita financeira
  const lancamentos = DB.get('lancamentos') || [];
  const [y, m] = data.split('-');
  const descricaoItens = [
    ...servicosArr.map(s => s.nome),
    ...produtosEstoqueArr.map(p => `${p.nome} x${p.qtd}`)
  ].filter(Boolean).join(', ');
  const lancamentoId = gerarId();
  lancamentos.push({
    id: lancamentoId,
    data,
    tipo: 'receita',
    categoria: 'Atendimento',
    valor: total,
    descricao: `${clientes[idx].nome} — ${descricaoItens}`,
    mesAno: `${y}-${m}`
  });
  lancamentos.sort((a, b) => a.data.localeCompare(b.data));
  DB.set('lancamentos', lancamentos);

  // Vincular o lançamento ao registro do atendimento para permitir exclusão precisa
  registro.lancamentoId = lancamentoId;
  DB.set('clientes_atendimento', clientes);

  showToast('Atendimento registrado e receita lançada');
  fecharModalAtendimento();
  renderClientes();

  const paginaAtiva = document.querySelector('.page.active')?.id;
  if (paginaAtiva === 'page-dashboard') renderDashboard();
}

/* ─── Modal: Histórico de atendimentos do cliente ─── */
let modalHistClienteId = null;

function abrirModalHistoricoCliente(id) {
  modalHistClienteId = id;
  const clientes = DB.get('clientes_atendimento') || [];
  const c = clientes.find(x => x.id === id);
  if (!c) return;

  document.getElementById('modal-hist-cliente-titulo').textContent = `Histórico — ${c.nome}`;

  const btnWpp = document.getElementById('btn-whatsapp-hist');
  if (btnWpp) {
    btnWpp.onclick = () => abrirWhatsApp(c.telefone || '', c.nome);
  }

  const atendimentos = (c.atendimentos || []).slice().sort((a, b) => b.data.localeCompare(a.data));
  const lista = document.getElementById('hist-atend-lista');

  if (atendimentos.length === 0) {
    lista.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px">Nenhum atendimento registrado</div>`;
  } else {
    lista.innerHTML = atendimentos.map(a => {
      const tags = [
        ...a.servicos.map(s => `<span class="hist-atend-tag">${s.nome}</span>`),
        ...(a.produtosEstoque || []).map(p => `<span class="hist-atend-tag">${p.nome} x${p.qtd}</span>`),
        // Compatibilidade com registros antigos que ainda têm produto avulso
        a.produto ? `<span class="hist-atend-tag">${a.produto.nome}</span>` : ''
      ].filter(Boolean).join('');

      return `
        <div class="hist-atend-item">
          <div class="hist-atend-data">📅 ${formatDataBR(a.data)}</div>
          <div class="hist-atend-servicos">${tags}</div>
          <div class="hist-atend-total">
            <span style="color:var(--text-secondary)">Total</span>
            <div style="display:flex;align-items:center;gap:10px">
              <strong>${formatBRL(a.total)}</strong>
              <button class="btn btn-danger btn-sm" onclick="excluirAtendimentoCliente('${a.id}')">Excluir</button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  document.getElementById('modal-hist-cliente').classList.add('open');
}

function fecharModalHistoricoCliente() {
  document.getElementById('modal-hist-cliente').classList.remove('open');
  modalHistClienteId = null;
}

/* ─── Configurações: gestão de serviços precificados ─── */
function renderServicosConfig() {
  const servicos = DB.get('servicos_precos') || [];
  const container = document.getElementById('servico-cfg-list');

  if (servicos.length === 0) {
    container.innerHTML = `<div style="font-size:12px;color:var(--text-muted);padding:8px 0">Nenhum serviço cadastrado</div>`;
    return;
  }

  container.innerHTML = servicos.map(s => `
    <div class="servico-cfg-row">
      <input type="text" value="${s.nome}" onchange="editarServicoCfg('${s.id}', 'nome', this.value)">
      <input type="number" value="${s.valor}" min="0" step="0.01" onchange="editarServicoCfg('${s.id}', 'valor', this.value)">
      <button class="btn btn-danger btn-sm" onclick="removerServicoCfg('${s.id}')" title="Remover">×</button>
    </div>
  `).join('');
}

function editarServicoCfg(id, campo, valor) {
  const servicos = DB.get('servicos_precos') || [];
  const idx = servicos.findIndex(s => s.id === id);
  if (idx === -1) return;
  servicos[idx][campo] = campo === 'valor' ? (parseFloat(valor) || 0) : valor;
  DB.set('servicos_precos', servicos);
}

function adicionarServicoCfg() {
  const nomeInput = document.getElementById('novo-servico-nome');
  const valorInput = document.getElementById('novo-servico-valor');
  const nome = nomeInput.value.trim();
  const valor = parseFloat(valorInput.value);

  if (!nome || isNaN(valor) || valor <= 0) {
    showToast('Preencha nome e valor do serviço', 'error');
    return;
  }

  const servicos = DB.get('servicos_precos') || [];
  servicos.push({ id: gerarId(), nome, valor });
  DB.set('servicos_precos', servicos);
  nomeInput.value = '';
  valorInput.value = '';
  renderServicosConfig();
  showToast('Serviço adicionado');
}

function removerServicoCfg(id) {
  if (!confirm('Remover este serviço da lista?')) return;
  const servicos = (DB.get('servicos_precos') || []).filter(s => s.id !== id);
  DB.set('servicos_precos', servicos);
  renderServicosConfig();
}

/* ─── Atualizar navigate, init e backup para incluir clientes ─── */
const _navigateOriginal2 = navigate;
navigate = function(pageName) {
  _navigateOriginal2(pageName);
  if (pageName === 'clientes') renderClientes();
  if (pageName === 'configuracoes') renderServicosConfig();
};

const _exportarJSONOriginal2 = exportarJSON;
exportarJSON = function() {
  const dados = {
    lancamentos:        DB.get('lancamentos') || [],
    resumos_mensais:    DB.get('resumos_mensais') || [],
    config:              DB.get('config') || {},
    clientes_pacotes:   DB.get('clientes_pacotes') || [],
    clientes_atendimento: DB.get('clientes_atendimento') || [],
    servicos_precos:    DB.get('servicos_precos') || [],
    dataExportacao:     new Date().toISOString(),
    versao: '1.2'
  };
  download(`backup-barbearia-${mesAtual()}.json`, 'application/json', JSON.stringify(dados, null, 2));
  showToast('Backup exportado com sucesso');
};

const _importarJSONOriginal2 = importarJSON;
importarJSON = function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const dados = JSON.parse(ev.target.result);
      if (!dados.lancamentos || !dados.config) throw new Error('Formato inválido');
      if (!confirm(`Importar backup de ${dados.dataExportacao ? new Date(dados.dataExportacao).toLocaleDateString('pt-BR') : 'data desconhecida'}?\n\nIsso vai substituir todos os dados atuais.`)) return;
      DB.set('lancamentos',          dados.lancamentos);
      DB.set('resumos_mensais',      dados.resumos_mensais || []);
      DB.set('config',                dados.config);
      DB.set('clientes_pacotes',     dados.clientes_pacotes || []);
      DB.set('clientes_atendimento', dados.clientes_atendimento || []);
      DB.set('servicos_precos',      dados.servicos_precos || []);
      showToast('Backup importado com sucesso');
      renderConfiguracoes();
      renderServicosConfig();
      fecharMesesAnteriores();
    } catch {
      showToast('Arquivo inválido ou corrompido', 'error');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
};


/* ═══════════════════════════════════════════════
   CLIENTES INATIVOS — DASHBOARD E NAVEGAÇÃO
   ═══════════════════════════════════════════════ */

function renderCardInativosDashboard() {
  const el = document.getElementById('alert-card-inativos');
  if (!el) return;
  const total = contarClientesInativos();
  const dias = getDiasInatividadeConfig();

  el.className = 'alert-card-inativos' + (total === 0 ? ' zero' : '');
  document.getElementById('inativos-num').textContent = total;
  document.getElementById('inativos-num').className = 'alert-inativos-num' + (total === 0 ? ' zero' : '');
  document.getElementById('inativos-hint').textContent =
    total === 0 ? 'Nenhum cliente parado' : `${dias}+ dias sem atendimento`;
}

function irParaClientesInativos() {
  navigate('clientes');
  renderClientes('inativos');
}

/* ─── Configurações: inatividade e mensagem WhatsApp ─── */
function carregarConfigInatividade() {
  const config = DB.get('config') || {};
  const elDias = document.getElementById('cfg-dias-inatividade');
  const elMsg = document.getElementById('cfg-mensagem-retorno');
  if (elDias) elDias.value = config.diasInatividade || 40;
  if (elMsg) elMsg.value = config.mensagemRetorno ||
    'Olá, {nome}! Sentimos sua falta aqui na [nome da barbearia]. Que tal agendar um horário?';
}

/* ─── Integrar com salvarConfig e renderConfiguracoes existentes ─── */
const _salvarConfigOriginal = salvarConfig;
salvarConfig = function() {
  _salvarConfigOriginal();
  const config = DB.get('config') || {};
  const elDias = document.getElementById('cfg-dias-inatividade');
  const elMsg = document.getElementById('cfg-mensagem-retorno');
  config.diasInatividade = parseInt(elDias?.value) || 40;
  config.mensagemRetorno = (elMsg?.value || '').trim() ||
    'Olá, {nome}! Sentimos sua falta aqui na [nome da barbearia]. Que tal agendar um horário?';
  DB.set('config', config);
  renderDashboard.bind(null);
  const paginaAtiva = document.querySelector('.page.active')?.id;
  if (paginaAtiva === 'page-dashboard') renderCardInativosDashboard();
};

const _renderConfiguracoesOriginal = renderConfiguracoes;
renderConfiguracoes = function() {
  _renderConfiguracoesOriginal();
  carregarConfigInatividade();
};

/* ─── Excluir atendimento (e seu lançamento financeiro correspondente) ─── */
function excluirAtendimentoCliente(atendimentoId) {
  if (!confirm('Excluir este atendimento? A receita lançada nos financeiros também será removida.')) return;

  const clientes = DB.get('clientes_atendimento') || [];
  const idx = clientes.findIndex(c => c.id === modalHistClienteId);
  if (idx === -1) return;
  const c = clientes[idx];

  const atendimento = (c.atendimentos || []).find(a => a.id === atendimentoId);
  if (!atendimento) return;

  // Remover o lançamento financeiro vinculado
  if (atendimento.lancamentoId) {
    const lancamentos = (DB.get('lancamentos') || []).filter(l => l.id !== atendimento.lancamentoId);
    DB.set('lancamentos', lancamentos);
  }

  // Remover o atendimento do cliente
  c.atendimentos = (c.atendimentos || []).filter(a => a.id !== atendimentoId);
  DB.set('clientes_atendimento', clientes);

  showToast('Atendimento e receita removidos');
  abrirModalHistoricoCliente(modalHistClienteId);
  renderClientes();

  const paginaAtiva = document.querySelector('.page.active')?.id;
  if (paginaAtiva === 'page-dashboard') renderDashboard();
}

/* ═══════════════════════════════════════════════
   ESTOQUE DE PRODUTOS
   ═══════════════════════════════════════════════ */

function initEstoque() {
  if (!DB.get('estoque_produtos')) DB.set('estoque_produtos', []);
  const config = DB.get('config') || {};
  if (config.categorias && !config.categorias.includes('Produtos')) {
    config.categorias.push('Produtos');
    DB.set('config', config);
  }
}

/* ─── Render principal da aba ─── */
let estoqueTabAtiva = 'estoque';

/* ─── Dashboard de produtos: despesas, receitas e lucro do mês ─── */
function renderDashboardEstoque() {
  const atual = mesAtual();

  // Despesas do mês: compras de estoque feitas no mês (pela data de compra)
  const produtos = DB.get('estoque_produtos') || [];
  const despesaMes = produtos
    .filter(p => p.dataCompra && p.dataCompra.slice(0, 7) === atual)
    .reduce((s, p) => s + p.valorTotal, 0);

  // Receitas do mês: vendas de produtos do estoque feitas em atendimentos no mês
  const clientes = DB.get('clientes_atendimento') || [];
  let receitaMes = 0;
  clientes.forEach(c => {
    (c.atendimentos || []).forEach(a => {
      if (a.data && a.data.slice(0, 7) === atual) {
        (a.produtosEstoque || []).forEach(p => {
          receitaMes += p.qtd * p.valorUnitario;
        });
      }
    });
  });

  const lucroMes = receitaMes - despesaMes;

  document.getElementById('estoque-dash-despesa').textContent = formatBRL(despesaMes);
  document.getElementById('estoque-dash-receita').textContent = formatBRL(receitaMes);

  const lucroEl = document.getElementById('estoque-dash-lucro');
  lucroEl.textContent = formatBRL(lucroMes);
  lucroEl.className = 'stat-value ' + (lucroMes >= 0 ? 'positive' : 'negative');
}

function renderEstoque(tab) {
  if (tab) estoqueTabAtiva = tab;

  renderDashboardEstoque();

  const todos = DB.get('estoque_produtos') || [];
  const emEstoque = todos.filter(p => p.qtdRestante > 0);
  const ultimasCompras = todos.filter(p => p.qtdRestante === 0);

  document.getElementById('tab-count-estoque').textContent = emEstoque.length;
  document.getElementById('tab-count-ultimas-compras').textContent = ultimasCompras.length;

  document.getElementById('tab-btn-estoque').className = 'estoque-tab' + (estoqueTabAtiva === 'estoque' ? ' active' : '');
  document.getElementById('tab-btn-ultimas-compras').className = 'estoque-tab' + (estoqueTabAtiva === 'ultimas-compras' ? ' active' : '');

  const busca = (document.getElementById('estoque-busca')?.value || '').toLowerCase();
  let lista = estoqueTabAtiva === 'estoque' ? emEstoque.slice() : ultimasCompras.slice();
  if (busca) lista = lista.filter(p => p.nome.toLowerCase().includes(busca));

  lista.sort((a, b) => b.dataCompra.localeCompare(a.dataCompra));

  const tbody = document.getElementById('estoque-tbody');

  if (lista.length === 0) {
    const msg = estoqueTabAtiva === 'estoque' ? 'Nenhum produto em estoque' : 'Nenhuma compra esgotada ainda';
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--text-muted)">${msg}</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(p => renderLinhaEstoque(p)).join('');
}

function renderLinhaEstoque(p) {
  const esgotado = p.qtdRestante === 0;
  const botaoDecremento = esgotado ? '' :
    `<button class="btn-decremento" onclick="decrementarEstoque('${p.id}')" title="Dar baixa de 1 unidade">−1</button>`;

  return `
    <tr>
      <td>
        ${p.nome}
        ${esgotado ? '<span class="estoque-badge-esgotado" style="margin-left:8px">Esgotado</span>' : ''}
      </td>
      <td>${p.qtdRestante}</td>
      <td>${formatBRL(p.valorVenda || 0)}</td>
      <td style="text-align:right;white-space:nowrap">
        <button class="btn btn-secondary btn-sm" onclick="abrirModalEstoqueDetalhes('${p.id}')">Detalhes</button>
        ${botaoDecremento}
      </td>
    </tr>`;
}

/* ─── Modal de detalhes do produto ─── */
let modalEstoqueDetalhesProdutoId = null;

function abrirModalEstoqueDetalhes(id) {
  modalEstoqueDetalhesProdutoId = id;
  const produtos = DB.get('estoque_produtos') || [];
  const p = produtos.find(x => x.id === id);
  if (!p) return;

  const qtdVendida = p.qtdTotal - p.qtdRestante;
  const receitaProduto = qtdVendida * (p.valorVenda || 0);
  const lucroProduto = receitaProduto - p.valorTotal;

  document.getElementById('estd-titulo').textContent = `Detalhes — ${p.nome}`;
  document.getElementById('estd-despesa-total').textContent = formatBRL(p.valorTotal);
  document.getElementById('estd-valor-venda').textContent = formatBRL(p.valorVenda || 0);
  document.getElementById('estd-qtd-vendida').textContent = `${qtdVendida} de ${p.qtdTotal}`;

  const lucroEl = document.getElementById('estd-lucro');
  lucroEl.textContent = formatBRL(lucroProduto);
  lucroEl.className = 'estoque-detalhe-valor ' + (lucroProduto >= 0 ? 'lucro-positivo' : 'lucro-negativo');

  document.getElementById('modal-estoque-detalhes').classList.add('open');
}

function fecharModalEstoqueDetalhes() {
  document.getElementById('modal-estoque-detalhes').classList.remove('open');
  modalEstoqueDetalhesProdutoId = null;
}

function excluirProdutoEstoque() {
  if (!modalEstoqueDetalhesProdutoId) return;
  if (!confirm('Excluir este produto do estoque? A despesa lançada nos financeiros também será removida.')) return;

  const produtos = DB.get('estoque_produtos') || [];
  const p = produtos.find(x => x.id === modalEstoqueDetalhesProdutoId);
  if (!p) return;

  // Remover o lançamento financeiro vinculado (afeta dashboard principal, histórico e dashboard do estoque)
  if (p.lancamentoId) {
    const lancamentos = (DB.get('lancamentos') || []).filter(l => l.id !== p.lancamentoId);
    DB.set('lancamentos', lancamentos);
  }

  // Remover o produto do estoque
  const restantes = produtos.filter(x => x.id !== modalEstoqueDetalhesProdutoId);
  DB.set('estoque_produtos', restantes);

  showToast('Produto e despesa removidos');
  fecharModalEstoqueDetalhes();
  renderEstoque();

  const paginaAtiva = document.querySelector('.page.active')?.id;
  if (paginaAtiva === 'page-dashboard') renderDashboard();
}

/* ─── Decremento manual (sem gerar lançamento) ─── */
function decrementarEstoque(id) {
  const produtos = DB.get('estoque_produtos') || [];
  const idx = produtos.findIndex(p => p.id === id);
  if (idx === -1) return;

  const p = produtos[idx];
  if (p.qtdRestante <= 0) return;

  p.qtdRestante -= 1;

  if (p.qtdRestante === 0) {
    showToast(`${p.nome} esgotado — movido para Últimas compras`);
  } else {
    showToast(`${p.nome}: ${p.qtdRestante} restantes`);
  }

  DB.set('estoque_produtos', produtos);
  renderEstoque();
}

/* ─── Modal: Novo produto ─── */
function abrirModalEstoque() {
  document.getElementById('estq-nome').value = '';
  document.getElementById('estq-qtd').value = '';
  document.getElementById('estq-valor').value = '';
  document.getElementById('estq-valor-venda').value = '';
  document.getElementById('estq-data').value = new Date().toISOString().split('T')[0];
  document.getElementById('modal-estoque').classList.add('open');
}

function fecharModalEstoque() {
  document.getElementById('modal-estoque').classList.remove('open');
}

function salvarProdutoEstoque() {
  const nome = document.getElementById('estq-nome').value.trim();
  const qtd = parseInt(document.getElementById('estq-qtd').value);
  const valor = parseFloat(document.getElementById('estq-valor').value);
  const valorVenda = parseFloat(document.getElementById('estq-valor-venda').value);
  const data = document.getElementById('estq-data').value;

  if (!nome || isNaN(qtd) || qtd <= 0 || isNaN(valor) || valor <= 0 || isNaN(valorVenda) || valorVenda <= 0 || !data) {
    showToast('Preencha todos os campos corretamente', 'error');
    return;
  }

  const produtos = DB.get('estoque_produtos') || [];
  const novoProdutoId = gerarId();
  produtos.push({
    id: novoProdutoId,
    nome,
    qtdTotal: qtd,
    qtdRestante: qtd,
    valorTotal: valor,
    valorVenda,
    dataCompra: data,
    lancamentoId: null
  });

  // Gerar despesa financeira
  const lancamentos = DB.get('lancamentos') || [];
  const [y, m] = data.split('-');
  const lancamentoId = gerarId();
  lancamentos.push({
    id: lancamentoId,
    data,
    tipo: 'despesa',
    categoria: 'Produtos',
    valor,
    descricao: `Compra de estoque: ${nome} (${qtd} unidades)`,
    mesAno: `${y}-${m}`
  });
  lancamentos.sort((a, b) => a.data.localeCompare(b.data));
  DB.set('lancamentos', lancamentos);

  // Vincular o lançamento ao produto para permitir exclusão precisa
  const produtoSalvo = produtos.find(p => p.id === novoProdutoId);
  produtoSalvo.lancamentoId = lancamentoId;
  DB.set('estoque_produtos', produtos);

  showToast('Produto cadastrado e despesa lançada');
  fecharModalEstoque();
  renderEstoque('estoque');

  const paginaAtiva = document.querySelector('.page.active')?.id;
  if (paginaAtiva === 'page-dashboard') renderDashboard();
}

/* ─── Integrar navigate e backup ─── */
const _navigateOriginal3 = navigate;
navigate = function(pageName) {
  _navigateOriginal3(pageName);
  if (pageName === 'estoque') renderEstoque();
};

const _exportarJSONOriginal3 = exportarJSON;
exportarJSON = function() {
  const dados = {
    lancamentos:           DB.get('lancamentos') || [],
    resumos_mensais:       DB.get('resumos_mensais') || [],
    config:                 DB.get('config') || {},
    clientes_pacotes:      DB.get('clientes_pacotes') || [],
    clientes_atendimento:  DB.get('clientes_atendimento') || [],
    servicos_precos:       DB.get('servicos_precos') || [],
    estoque_produtos:      DB.get('estoque_produtos') || [],
    dataExportacao:        new Date().toISOString(),
    versao: '1.3'
  };
  download(`backup-barbearia-${mesAtual()}.json`, 'application/json', JSON.stringify(dados, null, 2));
  showToast('Backup exportado com sucesso');
};

const _importarJSONOriginal3 = importarJSON;
importarJSON = function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const dados = JSON.parse(ev.target.result);
      if (!dados.lancamentos || !dados.config) throw new Error('Formato inválido');
      if (!confirm(`Importar backup de ${dados.dataExportacao ? new Date(dados.dataExportacao).toLocaleDateString('pt-BR') : 'data desconhecida'}?\n\nIsso vai substituir todos os dados atuais.`)) return;
      DB.set('lancamentos',          dados.lancamentos);
      DB.set('resumos_mensais',      dados.resumos_mensais || []);
      DB.set('config',                dados.config);
      DB.set('clientes_pacotes',     dados.clientes_pacotes || []);
      DB.set('clientes_atendimento', dados.clientes_atendimento || []);
      DB.set('servicos_precos',      dados.servicos_precos || []);
      DB.set('estoque_produtos',     dados.estoque_produtos || []);
      showToast('Backup importado com sucesso');
      renderConfiguracoes();
      renderServicosConfig();
      fecharMesesAnteriores();
    } catch {
      showToast('Arquivo inválido ou corrompido', 'error');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
};
