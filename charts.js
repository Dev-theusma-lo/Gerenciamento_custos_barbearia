/* ═══════════════════════════════════════════════
   CHARTS — usando Chart.js
   ═══════════════════════════════════════════════ */

const CORES = {
  teal:   ['#4ecdc4','#38b2ac','#2c9e98'],
  blue:   ['#74b9e8','#4a9fd4','#2980b9','#1a6fa0'],
  green:  ['#81e6c8','#52d9b4','#30c9a0'],
  mix: [
    '#4ecdc4','#74b9e8','#81e6c8','#52d9b4',
    '#38b2ac','#4a9fd4','#2c9e98','#2980b9',
    '#30c9a0','#1a6fa0','#6dd5ed','#a8edea'
  ]
};

const CHART_DEFAULTS = {
  font: { family: "'Inter', system-ui, sans-serif" },
  gridColor: 'rgba(255,255,255,0.06)',
  tickColor: '#7a7894',
};

/* ─── Registrar defaults globais ─── */
function setupChartDefaults() {
  if (!window.Chart) return;
  Chart.defaults.font.family = CHART_DEFAULTS.font.family;
  Chart.defaults.color = CHART_DEFAULTS.tickColor;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.padding = 16;
  Chart.defaults.plugins.tooltip.backgroundColor = '#2c3260';
  Chart.defaults.plugins.tooltip.titleColor = '#f0eeea';
  Chart.defaults.plugins.tooltip.bodyColor = '#b8b5c4';
  Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,0.1)';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
}

/* ─── Destruir chart existente ─── */
function destroyChart(id) {
  const existing = Chart.getChart(id);
  if (existing) existing.destroy();
}

/* ══════════════════════════════════════
   GRÁFICO: 12 MESES (Dashboard)
   Barras: despesas por mês
   Linha: receitas por mês
   ══════════════════════════════════════ */
function renderChart12Meses() {
  if (!window.Chart) return;
  setupChartDefaults();

  const lancamentos = DB.get('lancamentos') || [];
  const resumos = DB.get('resumos_mensais') || [];
  const atual = mesAtual();

  // Montar os últimos 12 meses (inclusive o atual)
  const meses12 = [];
  const d = new Date();
  for (let i = 11; i >= 0; i--) {
    const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const key = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
    meses12.push(key);
  }

  const dadosDespesas = meses12.map(m => {
    if (m === atual) {
      const doMes = lancamentos.filter(l => l.mesAno === m && l.tipo === 'despesa');
      return doMes.reduce((s, l) => s + l.valor, 0);
    }
    const r = resumos.find(x => x.mesAno === m);
    return r ? r.totalDespesas : 0;
  });

  const dadosReceitas = meses12.map(m => {
    if (m === atual) {
      const doMes = lancamentos.filter(l => l.mesAno === m && l.tipo === 'receita');
      return doMes.reduce((s, l) => s + l.valor, 0);
    }
    const r = resumos.find(x => x.mesAno === m);
    return r ? r.totalReceitas : 0;
  });

  const labels = meses12.map(m => nomeMes(m));

  // Cor diferente para o mês atual (em andamento)
  const coresDespesas = '#e05555';
  const borderDespesas = '#e05555';

  destroyChart('chart-12meses');
  const ctx = document.getElementById('chart-12meses').getContext('2d');

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Despesas',
          data: dadosDespesas,
          backgroundColor: coresDespesas,
          borderColor: borderDespesas,
          borderWidth: 1.5,
          borderRadius: 6,
          borderSkipped: false,
          order: 2,
        },
        {
          label: 'Receitas',
          data: dadosReceitas,
          type: 'line',
          borderColor: '#4ecdc4',
          backgroundColor: 'rgba(78,205,196,0.08)',
          pointBackgroundColor: '#4ecdc4',
          pointBorderColor: '#1e2147',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          order: 1,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', align: 'end' },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${formatBRL(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: CHART_DEFAULTS.gridColor },
          ticks: { font: { size: 11 } }
        },
        y: {
          grid: { color: CHART_DEFAULTS.gridColor },
          ticks: {
            font: { size: 11 },
            callback: v => 'R$ ' + (v >= 1000 ? (v/1000).toFixed(1)+'k' : v)
          }
        }
      }
    }
  });

  // Indicador do mês atual
  const indEl = document.getElementById('chart-mes-atual-label');
  if (indEl) {
    const idx = meses12.indexOf(atual);
    indEl.textContent = idx >= 0 ? `Barra mais clara = mês atual (em andamento)` : '';
  }
}

/* ══════════════════════════════════════
   GRÁFICO: PIZZA — despesas por categoria
   ══════════════════════════════════════ */
function renderChartPizza(despesas) {
  if (!window.Chart) return;
  setupChartDefaults();
  destroyChart('chart-pizza');

  const agrupado = {};
  despesas.forEach(l => {
    agrupado[l.categoria] = (agrupado[l.categoria] || 0) + l.valor;
  });

  const labels = Object.keys(agrupado);
  const data   = Object.values(agrupado);

  if (labels.length === 0) {
    const canvas = document.getElementById('chart-pizza');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#7a7894';
    ctx.font = '13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Sem despesas neste período', canvas.width / 2, canvas.height / 2);
    return;
  }

  const ctx = document.getElementById('chart-pizza').getContext('2d');
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: CORES.mix.slice(0, labels.length),
        borderColor: '#1e2147',
        borderWidth: 2,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'right',
          labels: { font: { size: 11 }, padding: 12 }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${formatBRL(ctx.parsed)}`
          }
        }
      }
    }
  });
}

/* ══════════════════════════════════════
   GRÁFICO: BARRAS AGRUPADAS — meses
   Receitas vs Despesas (últimos 6 meses)
   ══════════════════════════════════════ */
function renderChartBarrasMes(lancamentos) {
  if (!window.Chart) return;
  setupChartDefaults();
  destroyChart('chart-barras-mes');

  const resumos = DB.get('resumos_mensais') || [];
  const atual = mesAtual();

  const meses6 = [];
  const d = new Date();
  for (let i = 5; i >= 0; i--) {
    const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
    meses6.push(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`);
  }

  const receitas = meses6.map(m => {
    if (m === atual) return lancamentos.filter(l => l.mesAno === m && l.tipo === 'receita').reduce((s,l) => s+l.valor, 0);
    return (resumos.find(r => r.mesAno === m) || {}).totalReceitas || 0;
  });

  const despesas = meses6.map(m => {
    if (m === atual) return lancamentos.filter(l => l.mesAno === m && l.tipo === 'despesa').reduce((s,l) => s+l.valor, 0);
    return (resumos.find(r => r.mesAno === m) || {}).totalDespesas || 0;
  });

  const ctx = document.getElementById('chart-barras-mes').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: meses6.map(m => nomeMes(m)),
      datasets: [
        {
          label: 'Receitas',
          data: receitas,
          backgroundColor: 'rgba(78,205,196,0.8)',
          borderColor: '#4ecdc4',
          borderWidth: 1.5,
          borderRadius: 5,
          borderSkipped: false,
        },
        {
          label: 'Despesas',
          data: despesas,
          backgroundColor: 'rgba(116,185,232,0.8)',
          borderColor: '#74b9e8',
          borderWidth: 1.5,
          borderRadius: 5,
          borderSkipped: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', align: 'end' },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${formatBRL(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: { grid: { color: CHART_DEFAULTS.gridColor }, ticks: { font: { size: 11 } } },
        y: {
          grid: { color: CHART_DEFAULTS.gridColor },
          ticks: {
            font: { size: 11 },
            callback: v => 'R$ ' + (v >= 1000 ? (v/1000).toFixed(1)+'k' : v)
          }
        }
      }
    }
  });
}
