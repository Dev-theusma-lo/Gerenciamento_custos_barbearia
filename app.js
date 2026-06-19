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
      categorias: [
        'Produtos', 'Aluguel', 'Energia elétrica', 'Água',
        'Salários', 'Comissões', 'Equipamentos', 'Marketing',
        'Serviços terceiros', 'Manutenção', 'Outros'
      ]
    });
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
  const filtroMes  = document.getElementById('hist-filtro-mes').value;
  const filtroTipo = document.getElementById('hist-filtro-tipo').value;
  const filtroCat  = document.getElementById('hist-filtro-cat').value;

  let filtrados = lancamentos.slice().reverse();
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
function renderClientes() {
  const clientes = DB.get('clientes_atendimento') || [];
  const busca = (document.getElementById('clientes-busca')?.value || '').toLowerCase();

  let lista = clientes.slice();
  if (busca) {
    lista = lista.filter(c =>
      c.nome.toLowerCase().includes(busca) || (c.telefone || '').includes(busca)
    );
  }
  lista.sort((a, b) => a.nome.localeCompare(b.nome));

  const grid = document.getElementById('clientes-grid');

  if (lista.length === 0) {
    grid.innerHTML = `
      <div class="cliente-empty">
        <div class="empty-icon">👤</div>
        <p>${clientes.length === 0 ? 'Nenhum cliente cadastrado ainda' : 'Nenhum cliente encontrado'}</p>
      </div>`;
    return;
  }

  grid.innerHTML = lista.map(c => renderCardCliente(c)).join('');
}

function renderCardCliente(c) {
  const isAniversario = checarMesAniversario(c.nascimento);
  const atendimentos = c.atendimentos || [];
  const totalAtendimentos = atendimentos.length;
  const clienteDesde = formatDataBR(c.clienteDesde);
  const nascimentoFmt = c.nascimento ? formatDataBR(c.nascimento) : '—';

  return `
    <div class="cliente-card ${isAniversario ? 'aniversario' : ''}">
      <div class="cliente-card-header">
        <div>
          <div class="cliente-nome">${c.nome}</div>
          <div class="cliente-tel">${c.telefone || '—'}</div>
        </div>
        ${isAniversario ? '<span class="cliente-badge-aniv">🎂 Aniversário</span>' : ''}
      </div>
      <div class="cliente-meta">
        <div class="cliente-meta-row"><span>Nascimento</span><strong>${nascimentoFmt}</strong></div>
        <div class="cliente-meta-row"><span>Cliente desde</span><strong>${clienteDesde}</strong></div>
        <div class="cliente-meta-row"><span>Atendimentos</span><strong>${totalAtendimentos}</strong></div>
      </div>
      <div class="cliente-actions">
        <button class="btn btn-primary btn-sm" onclick="abrirModalAtendimento('${c.id}')">+ Atendimento</button>
        <button class="btn btn-secondary btn-sm" onclick="abrirModalHistoricoCliente('${c.id}')">📋 Histórico</button>
        <button class="btn btn-secondary btn-sm" onclick="abrirModalCliente('${c.id}')">✏️</button>
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

function checarTresMeses(clienteDesde) {
  if (!clienteDesde) return false;
  const inicio = new Date(clienteDesde);
  const hoje = new Date();
  const diffDias = (hoje - inicio) / (1000 * 60 * 60 * 24);
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

  if (editandoClienteId) {
    const idx = clientes.findIndex(c => c.id === editandoClienteId);
    if (idx !== -1) {
      clientes[idx] = { ...clientes[idx], nome, telefone: tel, nascimento, clienteDesde: desde };
    }
    showToast('Cliente atualizado');
  } else {
    clientes.push({
      id: gerarId(),
      nome, telefone: tel, nascimento,
      clienteDesde: desde || new Date().toISOString().split('T')[0],
      atendimentos: []
    });
    showToast('Cliente cadastrado');
  }

  DB.set('clientes_atendimento', clientes);
  fecharModalCliente();
  renderClientes();
}

/* ─── Modal: Registrar atendimento ─── */
let atendimentoClienteId = null;
let servicosSelecionados = {};

function abrirModalAtendimento(clienteId) {
  atendimentoClienteId = clienteId;
  servicosSelecionados = {};

  const clientes = DB.get('clientes_atendimento') || [];
  const c = clientes.find(x => x.id === clienteId);
  if (!c) return;

  document.getElementById('atend-cliente-nome-tel').innerHTML =
    `<strong>${c.nome}</strong> · ${c.telefone || 'sem telefone'}`;
  document.getElementById('atend-data').value = new Date().toISOString().split('T')[0];
  document.getElementById('atend-produto-nome').value = '';
  document.getElementById('atend-produto-valor').value = '';

  // Avisos
  const avisosEl = document.getElementById('atend-avisos');
  let avisosHtml = '';
  if (checarTresMeses(c.clienteDesde)) {
    avisosHtml += `<div class="aviso-banner aviso-tres-meses">⭐ ${c.nome} já é cliente há 3 meses ou mais!</div>`;
  }
  if (checarMesAniversario(c.nascimento)) {
    avisosHtml += `<div class="aviso-banner aviso-aniversario">🎂 Aniversário de ${c.nome} é neste mês — considere uma cortesia</div>`;
  }
  avisosEl.innerHTML = avisosHtml;

  renderServicosChecklist();
  atualizarTotalAtendimento();

  document.getElementById('modal-atendimento').classList.add('open');
}

function fecharModalAtendimento() {
  document.getElementById('modal-atendimento').classList.remove('open');
  atendimentoClienteId = null;
  servicosSelecionados = {};
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

function atualizarTotalAtendimento() {
  const totalServicos = Object.values(servicosSelecionados).reduce((s, v) => s + v.valor, 0);
  const produtoValor = parseFloat(document.getElementById('atend-produto-valor').value) || 0;
  const total = totalServicos + produtoValor;
  document.getElementById('atend-total-valor').textContent = formatBRL(total);
}

function salvarAtendimento() {
  const data = document.getElementById('atend-data').value;
  const produtoNome = document.getElementById('atend-produto-nome').value.trim();
  const produtoValor = parseFloat(document.getElementById('atend-produto-valor').value) || 0;

  if (!data) {
    showToast('Selecione a data do atendimento', 'error');
    return;
  }

  const servicosArr = Object.values(servicosSelecionados);
  if (servicosArr.length === 0 && produtoValor <= 0) {
    showToast('Selecione ao menos um serviço ou produto', 'error');
    return;
  }
  if (produtoValor > 0 && !produtoNome) {
    showToast('Informe o nome do produto avulso', 'error');
    return;
  }

  const totalServicos = servicosArr.reduce((s, v) => s + v.valor, 0);
  const total = totalServicos + produtoValor;

  const clientes = DB.get('clientes_atendimento') || [];
  const idx = clientes.findIndex(c => c.id === atendimentoClienteId);
  if (idx === -1) return;

  const registro = {
    id: gerarId(),
    data,
    servicos: servicosArr,
    produto: produtoValor > 0 ? { nome: produtoNome, valor: produtoValor } : null,
    total
  };

  clientes[idx].atendimentos = clientes[idx].atendimentos || [];
  clientes[idx].atendimentos.push(registro);
  clientes[idx].atendimentos.sort((a, b) => a.data.localeCompare(b.data));
  DB.set('clientes_atendimento', clientes);

  // Gerar receita financeira
  const lancamentos = DB.get('lancamentos') || [];
  const [y, m] = data.split('-');
  const descricaoItens = [...servicosArr.map(s => s.nome), produtoNome].filter(Boolean).join(', ');
  lancamentos.push({
    id: gerarId(),
    data,
    tipo: 'receita',
    categoria: 'Atendimento',
    valor: total,
    descricao: `${clientes[idx].nome} — ${descricaoItens}`,
    mesAno: `${y}-${m}`
  });
  lancamentos.sort((a, b) => a.data.localeCompare(b.data));
  DB.set('lancamentos', lancamentos);

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

  const atendimentos = (c.atendimentos || []).slice().sort((a, b) => b.data.localeCompare(a.data));
  const lista = document.getElementById('hist-atend-lista');

  if (atendimentos.length === 0) {
    lista.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px">Nenhum atendimento registrado</div>`;
  } else {
    lista.innerHTML = atendimentos.map(a => {
      const tags = [
        ...a.servicos.map(s => `<span class="hist-atend-tag">${s.nome}</span>`),
        a.produto ? `<span class="hist-atend-tag">${a.produto.nome}</span>` : ''
      ].filter(Boolean).join('');

      return `
        <div class="hist-atend-item">
          <div class="hist-atend-data">📅 ${formatDataBR(a.data)}</div>
          <div class="hist-atend-servicos">${tags}</div>
          <div class="hist-atend-total">
            <span style="color:var(--text-secondary)">Total</span>
            <strong>${formatBRL(a.total)}</strong>
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

