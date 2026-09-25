/* ─────────────────────────────────────────────────
   Personal Finance Advisor — Main Script
   ───────────────────────────────────────────────── */

'use strict';

// ── State ────────────────────────────────────────
let currentSection = 'dashboard';
let currentMonth = '';
let categories = [];
let donutChart = null;
let barChart = null;
let pendingDeleteId = null;

// ── Chart palette ────────────────────────────────
const PALETTE = [
  '#4f46e5','#10b981','#f59e0b','#ef4444','#3b82f6',
  '#8b5cf6','#06b6d4','#f97316','#ec4899','#14b8a6'
];

// ── Utility ───────────────────────────────────────
const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

function showToast(msg, type = 'default') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => { t.className = 'toast'; }, 3500);
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API error');
  return data;
}

function formatMonthLabel(m) {
  if (!m) return '';
  const [y, mo] = m.split('-');
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[parseInt(mo) - 1]} ${y}`;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── Navigation ────────────────────────────────────
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(a => a.classList.remove('active'));
  document.getElementById(`section-${name}`).classList.add('active');
  document.querySelectorAll(`.nav-item[data-section="${name}"]`).forEach(a => a.classList.add('active'));
  currentSection = name;

  // Close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');

  loadSection(name);
}

function loadSection(name) {
  switch (name) {
    case 'dashboard': loadDashboard(); break;
    case 'expenses':  loadExpenses();  break;
    case 'budget':    loadBudget();    break;
    case 'ai-advisor': loadAIAdvice(); break;
    case 'summary':   loadSummary();   break;
  }
}

// ── Month selector ────────────────────────────────
async function loadMonths() {
  const data = await api('/api/months');
  const months = data.months;
  ['globalMonth', 'globalMonthMobile'].forEach(id => {
    const sel = document.getElementById(id);
    sel.innerHTML = '';
    months.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = formatMonthLabel(m);
      if (m === currentMonth) opt.selected = true;
      sel.appendChild(opt);
    });
  });
}

function setMonthLabels(m) {
  ['dashMonthLabel','expMonthLabel','budgetMonthLabel','aiMonthLabel','summaryMonthLabel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = formatMonthLabel(m);
  });
}

// ── Dashboard ─────────────────────────────────────
async function loadDashboard() {
  try {
    const [summary, expenses] = await Promise.all([
      api(`/api/summary?month=${currentMonth}`),
      api(`/api/expenses?month=${currentMonth}`)
    ]);

    document.getElementById('kpiIncome').textContent    = fmt(summary.income);
    document.getElementById('kpiExpenses').textContent  = fmt(summary.total_expenses);
    document.getElementById('kpiSavings').textContent   = fmt(summary.savings);
    document.getElementById('kpiSavingsPct').textContent = summary.savings_pct + '%';
    document.getElementById('kpiTxn').textContent       = summary.num_transactions;

    // Color savings KPI
    const savingsEl = document.getElementById('kpiSavings');
    savingsEl.style.color = summary.savings < 0 ? 'var(--danger)' : 'var(--text)';

    renderDonutChart(summary.category_totals);
    renderBarChart(summary.income, summary.total_expenses, summary.savings);
    renderRecentTable(expenses.expenses.slice(0, 7));
  } catch (e) {
    showToast('Failed to load dashboard: ' + e.message, 'error');
  }
}

function renderDonutChart(catTotals) {
  const filtered = Object.entries(catTotals).filter(([,v]) => v > 0);
  const labels = filtered.map(([k]) => k);
  const values = filtered.map(([,v]) => v);
  const colors = labels.map((_, i) => PALETTE[i % PALETTE.length]);

  const ctx = document.getElementById('donutChart').getContext('2d');
  if (donutChart) donutChart.destroy();

  if (values.length === 0) {
    const legend = document.getElementById('donutLegend');
    legend.innerHTML = '<div style="color:var(--text-3);font-size:.8rem">No expenses this month</div>';
    donutChart = new Chart(ctx, {
      type: 'doughnut',
      data: { labels: ['No data'], datasets: [{ data: [1], backgroundColor: ['#e2e8f0'] }] },
      options: { plugins: { legend: { display: false }, tooltip: { enabled: false } }, cutout: '65%', responsive: true, maintainAspectRatio: false }
    });
    return;
  }

  donutChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '60%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${fmt(ctx.raw)} (${((ctx.raw / values.reduce((a,b) => a+b, 0)) * 100).toFixed(1)}%)`
          }
        }
      }
    }
  });

  const legend = document.getElementById('donutLegend');
  legend.innerHTML = labels.map((l, i) =>
    `<div class="legend-item"><div class="legend-dot" style="background:${colors[i]}"></div>${l}: ${fmt(values[i])}</div>`
  ).join('');
}

function renderBarChart(income, expenses, savings) {
  const ctx = document.getElementById('barChart').getContext('2d');
  if (barChart) barChart.destroy();
  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Income', 'Expenses', 'Savings'],
      datasets: [{
        data: [income, expenses, Math.max(0, savings)],
        backgroundColor: ['rgba(16,185,129,.8)', 'rgba(239,68,68,.8)', 'rgba(79,70,229,.8)'],
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` ${fmt(c.raw)}` } }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (v) => '₹' + (v >= 1000 ? (v/1000).toFixed(0) + 'k' : v) },
          grid: { color: '#e2e8f0' }
        },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderRecentTable(expenses) {
  const tbody = document.getElementById('recentTableBody');
  if (!expenses.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-row">No expenses yet</td></tr>';
    return;
  }
  tbody.innerHTML = expenses.map(e => `
    <tr>
      <td>${e.date}</td>
      <td><span class="badge badge-${e.category}">${e.category}</span></td>
      <td style="color:var(--text-2)">${e.description || '—'}</td>
      <td><strong>${fmt(e.amount)}</strong></td>
    </tr>`).join('');
}

// ── Expenses ──────────────────────────────────────
async function loadExpenses() {
  try {
    const cat = document.getElementById('filterCategory').value || 'All';
    const data = await api(`/api/expenses?month=${currentMonth}&category=${encodeURIComponent(cat)}`);
    const expenses = data.expenses;
    renderExpenseTable(expenses);
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    document.getElementById('expenseTotal').textContent = expenses.length
      ? `${expenses.length} transaction(s)  ·  Total: ${fmt(total)}`
      : '';
    const summary = await api(`/api/summary?month=${currentMonth}`);
    document.getElementById('filterSummary').textContent =
      `Income: ${fmt(summary.income)}  |  Total Expenses: ${fmt(summary.total_expenses)}  |  Balance: ${fmt(summary.savings)}`;
  } catch (e) {
    showToast('Failed to load expenses: ' + e.message, 'error');
  }
}

function renderExpenseTable(expenses) {
  const tbody = document.getElementById('expenseTableBody');
  if (!expenses.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-row">No expenses. Click "+ Add Expense" to get started.</td></tr>';
    return;
  }
  tbody.innerHTML = expenses.map(e => `
    <tr>
      <td>${e.date}</td>
      <td><span class="badge badge-${e.category}">${e.category}</span></td>
      <td style="color:var(--text-2);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.description || '—'}</td>
      <td><strong>${fmt(e.amount)}</strong></td>
      <td>
        <button class="btn btn-icon" title="Delete" onclick="confirmDelete(${e.id})">🗑️</button>
      </td>
    </tr>`).join('');
}

function confirmDelete(id) {
  pendingDeleteId = id;
  openModal('deleteModal');
  document.getElementById('confirmDeleteBtn').onclick = async () => {
    try {
      await api(`/api/expenses/${pendingDeleteId}`, { method: 'DELETE' });
      closeModal('deleteModal');
      showToast('Expense deleted', 'success');
      loadExpenses();
      if (currentSection === 'dashboard') loadDashboard();
    } catch (e) {
      showToast('Failed to delete: ' + e.message, 'error');
    }
  };
}

// ── Budget ────────────────────────────────────────
async function loadBudget() {
  try {
    const data = await api(`/api/budget?month=${currentMonth}`);
    const income = data.income;

    if (income === 0) {
      document.getElementById('budgetNoIncome').style.display = 'block';
      document.getElementById('budgetContent').style.display = 'none';
      return;
    }
    document.getElementById('budgetNoIncome').style.display = 'none';
    document.getElementById('budgetContent').style.display = 'block';

    const tbody = document.getElementById('budgetTableBody');
    tbody.innerHTML = data.budget.map(b => {
      const isNA = b.recommended === 0 && b.actual === 0;
      const diffClass = b.overspent ? 'amount-neg' : 'amount-pos';
      const statusClass = b.overspent ? 'status-over' : isNA ? 'status-na' : 'status-ok';
      const statusText = isNA ? '—' : b.overspent ? '⚠ Over' : '✓ OK';
      const diffPrefix = b.difference >= 0 ? '+' : '';
      return `<tr>
        <td><strong>${b.category}</strong></td>
        <td>${fmt(b.recommended)}</td>
        <td>${fmt(b.actual)}</td>
        <td class="${diffClass}">${diffPrefix}${fmt(b.difference)}</td>
        <td class="${statusClass}">${statusText}</td>
      </tr>`;
    }).join('');

    // Progress bars
    const barsContainer = document.getElementById('budgetBars');
    barsContainer.innerHTML = data.budget
      .filter(b => b.category !== 'Savings (Target)')
      .map(b => {
        const pct = b.recommended > 0 ? Math.min((b.actual / b.recommended) * 100, 150) : 0;
        const over = b.overspent;
        const displayPct = Math.min(pct, 100);
        return `<div class="budget-bar-row">
          <div class="budget-bar-labels">
            <span>${b.category}</span>
            <span>${fmt(b.actual)} / ${fmt(b.recommended)} ${over ? '⚠️' : ''}</span>
          </div>
          <div class="budget-bar-track">
            <div class="budget-bar-fill ${over ? 'over' : ''}" style="width:${displayPct}%"></div>
          </div>
        </div>`;
      }).join('');
  } catch (e) {
    showToast('Failed to load budget: ' + e.message, 'error');
  }
}

// ── AI Advisor ────────────────────────────────────
async function loadAIAdvice() {
  const container = document.getElementById('adviceContainer');
  const loading = document.getElementById('aiLoading');
  const banner = document.getElementById('aiSourceBanner');
  const sourceText = document.getElementById('aiSourceText');

  container.innerHTML = '';
  loading.style.display = 'flex';
  banner.style.display = 'none';
  document.getElementById('refreshAdviceBtn').disabled = true;

  try {
    const data = await api(`/api/ai-advice?month=${currentMonth}`);
    loading.style.display = 'none';

    // Source banner
    banner.style.display = 'flex';
    sourceText.textContent = data.note || '';
    banner.style.background = data.source === 'gemini-ai'
      ? 'var(--success-light)' : 'var(--info-light)';
    banner.style.color = data.source === 'gemini-ai' ? '#065f46' : '#1e40af';

    if (!data.advice || data.advice.length === 0) {
      container.innerHTML = '<div class="advice-card">No advice available. Please set your income first.</div>';
      return;
    }

    container.innerHTML = data.advice.map(tip => {
      let cls = '';
      if (tip.includes('🚨') || tip.includes('Warning') || tip.includes('exceed')) cls = 'danger';
      else if (tip.includes('⚠') || tip.includes('above') || tip.includes('Over')) cls = 'warning';
      else if (tip.includes('✅') || tip.includes('🌟') || tip.includes('👍') || tip.includes('Great')) cls = 'success';
      return `<div class="advice-card ${cls}">${tip}</div>`;
    }).join('');
  } catch (e) {
    loading.style.display = 'none';
    container.innerHTML = `<div class="advice-card danger">Failed to load advice: ${e.message}</div>`;
  } finally {
    document.getElementById('refreshAdviceBtn').disabled = false;
  }
}

// ── Monthly Summary ───────────────────────────────
async function loadSummary() {
  try {
    const summary = await api(`/api/summary?month=${currentMonth}`);
    const budget  = await api(`/api/budget?month=${currentMonth}`);

    document.getElementById('sumIncome').textContent   = fmt(summary.income);
    document.getElementById('sumExpenses').textContent = fmt(summary.total_expenses);
    document.getElementById('sumSavings').textContent  = fmt(summary.savings);
    document.getElementById('sumPct').textContent      = summary.savings_pct + '%';

    document.getElementById('sumSavings').style.color =
      summary.savings < 0 ? 'var(--danger)' : 'var(--text)';

    // Category spending list
    const catList = document.getElementById('catSpendingList');
    const catEntries = Object.entries(summary.category_totals)
      .filter(([,v]) => v > 0)
      .sort(([,a],[,b]) => b - a);

    if (catEntries.length === 0) {
      catList.innerHTML = '<div class="cat-spend-row" style="color:var(--text-3)">No expenses recorded</div>';
    } else {
      catList.innerHTML = catEntries.map(([cat, amt]) => `
        <div class="cat-spend-row">
          <span><span class="badge badge-${cat}">${cat}</span></span>
          <span class="cat-amount">${fmt(amt)}</span>
        </div>`).join('');
    }

    // Insights
    const insights = document.getElementById('summaryInsights');
    const insightList = [];

    if (summary.income === 0) {
      insightList.push({ emoji: 'ℹ️', text: 'No income set for this month.' });
    } else {
      if (summary.savings < 0) {
        insightList.push({ emoji: '🚨', text: `Expenses exceed income by ${fmt(Math.abs(summary.savings))}.` });
      } else if (summary.savings_pct >= 20) {
        insightList.push({ emoji: '✅', text: `Savings rate of ${summary.savings_pct}% meets the 20% target.` });
      } else {
        insightList.push({ emoji: '⚠️', text: `Savings rate of ${summary.savings_pct}% is below the 20% target.` });
      }
      if (summary.highest_category && summary.highest_category_amount > 0) {
        insightList.push({ emoji: '📊', text: `Highest spend: ${summary.highest_category} at ${fmt(summary.highest_category_amount)}.` });
      }
      const overBudget = budget.budget.filter(b => b.overspent && b.category !== 'Savings (Target)' && b.actual > 0);
      if (overBudget.length) {
        insightList.push({ emoji: '⚠️', text: `Over budget in: ${overBudget.map(b => b.category).join(', ')}.` });
      } else if (summary.total_expenses > 0) {
        insightList.push({ emoji: '👍', text: 'All category spending is within budget guidelines.' });
      }
      const txn = summary.num_transactions;
      insightList.push({ emoji: '🧾', text: `${txn} transaction${txn !== 1 ? 's' : ''} recorded this month.` });
    }

    insights.innerHTML = insightList.map(i =>
      `<div class="insight-item"><span>${i.emoji}</span><span>${i.text}</span></div>`
    ).join('');

    // Recommendations from budget
    const recs = document.getElementById('summaryRecommendations');
    const recList = [];
    if (summary.income > 0) {
      budget.budget.forEach(b => {
        if (b.overspent && b.actual > 0) {
          recList.push(`📉 Reduce <strong>${b.category}</strong> spending by ${fmt(Math.abs(b.difference))} to stay within budget.`);
        }
      });
      if (summary.savings_pct < 20 && summary.savings > 0) {
        recList.push(`💡 Try to save an additional ${fmt(summary.income * 0.2 - summary.savings)} to hit the 20% savings target.`);
      }
      if (summary.savings < 0) {
        recList.push(`🚨 Urgent: Cut expenses by ${fmt(Math.abs(summary.savings))} to avoid a deficit this month.`);
      }
      if (recList.length === 0) {
        recList.push(`🌟 Great job! Your finances are on track this month. Keep maintaining these healthy habits.`);
      }
    } else {
      recList.push('ℹ️ Set your monthly income to see personalized recommendations.');
    }
    recs.innerHTML = recList.map(r => `<div class="rec-item"><span>${r}</span></div>`).join('');
  } catch (e) {
    showToast('Failed to load summary: ' + e.message, 'error');
  }
}

// ── Income Modal ──────────────────────────────────
function openIncomeModal() {
  document.getElementById('incomeMonth').value = currentMonth;
  // Pre-fill existing income
  api(`/api/income?month=${currentMonth}`).then(data => {
    if (data.income) document.getElementById('incomeAmount').value = data.income;
    else document.getElementById('incomeAmount').value = '';
  });
  openModal('incomeModal');
}

async function submitIncome(e) {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('incomeAmount').value);
  const month  = document.getElementById('incomeMonth').value;
  if (isNaN(amount) || amount < 0) {
    showToast('Please enter a valid income amount', 'error');
    return;
  }
  try {
    await api('/api/income', {
      method: 'POST',
      body: JSON.stringify({ amount, month })
    });
    closeModal('incomeModal');
    showToast(`Income set to ${fmt(amount)} for ${formatMonthLabel(month)}`, 'success');
    await loadMonths();
    loadSection(currentSection);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Expense Modal ─────────────────────────────────
function openExpenseModal() {
  document.getElementById('expDate').value = todayStr();
  document.getElementById('expAmount').value = '';
  document.getElementById('expDesc').value = '';
  document.getElementById('expCategory').value = '';
  openModal('expenseModal');
}

async function submitExpense(e) {
  e.preventDefault();
  const amount   = parseFloat(document.getElementById('expAmount').value);
  const category = document.getElementById('expCategory').value;
  const desc     = document.getElementById('expDesc').value.trim();
  const date     = document.getElementById('expDate').value;

  if (!amount || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }
  if (!category)              { showToast('Select a category', 'error');   return; }
  if (!date)                  { showToast('Select a date', 'error');        return; }

  try {
    await api('/api/expenses', {
      method: 'POST',
      body: JSON.stringify({ amount, category, description: desc, date })
    });
    closeModal('expenseModal');
    showToast(`${fmt(amount)} expense added`, 'success');
    await loadMonths();
    loadSection(currentSection);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Category dropdown population ──────────────────
function populateCategoryDropdowns(cats) {
  categories = cats;
  const expCat = document.getElementById('expCategory');
  expCat.innerHTML = '<option value="">Select category</option>';
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    expCat.appendChild(opt);
  });

  const filterCat = document.getElementById('filterCategory');
  filterCat.innerHTML = '<option value="All">All Categories</option>';
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    filterCat.appendChild(opt);
  });
}

// ── Sidebar toggle (mobile) ───────────────────────
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

document.addEventListener('click', (e) => {
  const sidebar = document.getElementById('sidebar');
  const hamburger = document.getElementById('hamburger');
  if (window.innerWidth <= 700 && sidebar.classList.contains('open') &&
      !sidebar.contains(e.target) && e.target !== hamburger) {
    sidebar.classList.remove('open');
  }
});

// ── Nav links ─────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    showSection(item.dataset.section);
  });
});

document.querySelectorAll('.view-all').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    showSection(link.dataset.section);
  });
});

// ── Month selector ────────────────────────────────
function onMonthChange(val) {
  currentMonth = val;
  // Sync both selectors
  document.getElementById('globalMonth').value = val;
  document.getElementById('globalMonthMobile').value = val;
  setMonthLabels(val);
  loadSection(currentSection);
}

document.getElementById('globalMonth').addEventListener('change', (e) => onMonthChange(e.target.value));
document.getElementById('globalMonthMobile').addEventListener('change', (e) => onMonthChange(e.target.value));

// ── Close modals on overlay click ─────────────────
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// ── Init ──────────────────────────────────────────
async function init() {
  try {
    currentMonth = currentMonthStr();

    const catData = await api('/api/categories');
    populateCategoryDropdowns(catData.categories);

    await loadMonths();
    setMonthLabels(currentMonth);

    document.getElementById('globalMonth').value = currentMonth;
    document.getElementById('globalMonthMobile').value = currentMonth;

    loadDashboard();
  } catch (e) {
    console.error('Init error:', e);
    showToast('Failed to initialize app. Is the server running?', 'error');
  }
}

document.addEventListener('DOMContentLoaded', init);
