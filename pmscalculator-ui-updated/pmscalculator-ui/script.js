const MIN_INVESTMENT = 5000000;
const MAX_YEARS = 6;
const PERFORMANCE_FEE_RATE = 0.20;
const DEFAULT_RETURNS = [12, -3, 18, 12, 12, 12];

const state = {
  returns: [...DEFAULT_RETURNS]
};

function formatCurrency(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatCurrencyCompact(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 0
  })}`;
}

function parseInvestment() {
  const input = document.getElementById('investment');
  const numeric = Number(String(input.value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatInvestmentInput() {
  const input = document.getElementById('investment');
  const value = parseInvestment();
  input.value = value ? Math.round(value).toLocaleString('en-IN') : '';
}

function setRangeFill(input) {
  const min = Number(input.min);
  const max = Number(input.max);
  const value = Number(input.value);
  const percentage = max === min ? 0 : ((value - min) / (max - min)) * 100;
  input.style.setProperty('--fill', `${percentage}%`);
}

function getSelectedPlan() {
  const selected = document.querySelector('input[name="fixedFee"]:checked');
  return {
    fixedFeeRate: Number(selected.value) / 100,
    hurdleRate: Number(selected.dataset.hurdle || 0) / 100,
    hasPerformanceFee: Number(selected.value) < 3
  };
}

function calculateFixedFee(averageNav, fixedFeeRate) {
  return averageNav * fixedFeeRate;
}

function calculateOtherExpenses(openingNav, navAfterFixedFee, otherExpensesRate) {
  const averageNavOtherExpenses = (openingNav + navAfterFixedFee) / 2;
  return averageNavOtherExpenses * otherExpensesRate;
}

function calculatePerformanceFee(navAfterOtherExpenses, previousHighWatermark, hurdleRate) {
  const hurdleAmount = previousHighWatermark * (1 + hurdleRate);
  const gainAboveHurdle = navAfterOtherExpenses - hurdleAmount;
  return Math.max(gainAboveHurdle, 0) * PERFORMANCE_FEE_RATE;
}

function calculateProjection(initialInvestment, fixedFeeRate, otherExpensesRate, hurdleRate, hasPerformanceFee, period) {
  let previousHighWatermark = initialInvestment;
  let yearEndNav = initialInvestment;
  let totalFees = 0;
  const rows = [];

  for (let year = 1; year <= period; year += 1) {
    const expectedReturn = (state.returns[year - 1] || 0) / 100;
    const openingNav = yearEndNav;
    const navBeforeFees = openingNav * (1 + expectedReturn);
    const averageNavFixedFee = (openingNav + navBeforeFees) / 2;
    const fixedFee = calculateFixedFee(averageNavFixedFee, fixedFeeRate);
    const navAfterFixedFee = navBeforeFees - fixedFee;
    const otherExpenses = calculateOtherExpenses(openingNav, navAfterFixedFee, otherExpensesRate);
    const navAfterOtherExpenses = navAfterFixedFee - otherExpenses;
    const highWatermark = Math.max(previousHighWatermark, navAfterOtherExpenses);
    const performanceFee = hasPerformanceFee
      ? calculatePerformanceFee(navAfterOtherExpenses, previousHighWatermark, hurdleRate)
      : 0;
    const totalFeesForYear = fixedFee + otherExpenses + performanceFee;

    yearEndNav = navAfterOtherExpenses - performanceFee;
    previousHighWatermark = highWatermark;
    totalFees += totalFeesForYear;

    rows.push({
      fixedFee,
      otherExpenses,
      highWatermark,
      performanceFee,
      yearEndNav,
      totalFeesForYear
    });
  }

  return { rows, totalFees };
}

function createReturnStepper(year, value) {
  return `
    <div class="year-head">
      <span class="year-title">Year ${year} Returns</span>
      <div class="return-stepper">
        <input
          type="number"
          class="return-input"
          data-year="${year}"
          min="-100"
          max="100"
          step="1"
          value="${value}"
          aria-label="Year ${year} expected return percentage"
        >
        <div class="step-buttons">
          <button type="button" class="step-button" data-step="1" data-year="${year}" aria-label="Increase Year ${year} return">▲</button>
          <button type="button" class="step-button" data-step="-1" data-year="${year}" aria-label="Decrease Year ${year} return">▼</button>
        </div>
      </div>
    </div>
  `;
}

function renderTableHeader(period) {
  const head = document.getElementById('resultsHead');
  const yearHeaders = Array.from({ length: period }, (_, index) => (
    `<th>${createReturnStepper(index + 1, state.returns[index])}</th>`
  )).join('');

  head.innerHTML = `
    <tr>
      <th class="metric-col">Fees</th>
      ${yearHeaders}
    </tr>
  `;
}

function renderTableBody(projection) {
  const body = document.getElementById('resultsBody');
  const metrics = [
    ['Fixed Fee', 'fixedFee'],
    ['Other Expenses', 'otherExpenses'],
    ['High Watermark', 'highWatermark'],
    ['Performance Fee', 'performanceFee'],
    ['Year End NAV', 'yearEndNav']
  ];

  const rowsHtml = metrics.map(([label, key]) => {
    const cells = projection.rows
      .map(row => `<td>${formatCurrencyCompact(row[key])}</td>`)
      .join('');
    return `<tr><td>${label}</td>${cells}</tr>`;
  }).join('');

  const totalCells = projection.rows
    .map(row => `<td>${formatCurrency(row.totalFeesForYear)}</td>`)
    .join('');

  body.innerHTML = `${rowsHtml}<tr class="total-row"><td>Total Fees</td>${totalCells}</tr>`;
}

function updateInvestmentHelp(initialInvestment) {
  const help = document.getElementById('investmentHelp');
  if (initialInvestment > 0 && initialInvestment < MIN_INVESTMENT) {
    help.textContent = 'Minimum investment is ₹50,00,000. Results are shown at the minimum amount.';
    help.classList.add('is-error');
  } else {
    help.textContent = 'Minimum investment: ₹50,00,000';
    help.classList.remove('is-error');
  }
}

function calculateAndRender({ renderHeader = true } = {}) {
  const rawInvestment = parseInvestment();
  const initialInvestment = Math.max(rawInvestment || MIN_INVESTMENT, MIN_INVESTMENT);
  const otherExpensesRate = Number(document.getElementById('otherExpenses').value) / 100;
  const period = Number(document.getElementById('period').value);
  const { fixedFeeRate, hurdleRate, hasPerformanceFee } = getSelectedPlan();

  updateInvestmentHelp(rawInvestment);

  const projection = calculateProjection(
    initialInvestment,
    fixedFeeRate,
    otherExpensesRate,
    hurdleRate,
    hasPerformanceFee,
    period
  );

  if (renderHeader) renderTableHeader(period);
  renderTableBody(projection);
}

function updateControlOutputs() {
  const expenses = document.getElementById('otherExpenses');
  const period = document.getElementById('period');

  document.getElementById('otherExpensesValue').textContent = `${Number(expenses.value).toFixed(2)}%`;
  document.getElementById('periodValue').textContent = `${period.value} ${Number(period.value) === 1 ? 'Year' : 'Years'}`;

  setRangeFill(expenses);
  setRangeFill(period);
}

function handleTableInteraction(event) {
  const returnInput = event.target.closest('.return-input');
  if (returnInput) {
    const yearIndex = Number(returnInput.dataset.year) - 1;
    const parsed = Number(returnInput.value);
    state.returns[yearIndex] = Number.isFinite(parsed) ? Math.min(100, Math.max(-100, parsed)) : 0;
    calculateAndRender({ renderHeader: false });
    return;
  }

  const stepButton = event.target.closest('.step-button');
  if (stepButton) {
    const yearIndex = Number(stepButton.dataset.year) - 1;
    const step = Number(stepButton.dataset.step);
    state.returns[yearIndex] = Math.min(100, Math.max(-100, state.returns[yearIndex] + step));
    calculateAndRender();
  }
}

function initialise() {
  const investment = document.getElementById('investment');
  const expenses = document.getElementById('otherExpenses');
  const period = document.getElementById('period');
  const resultsHead = document.getElementById('resultsHead');

  investment.addEventListener('input', calculateAndRender);
  investment.addEventListener('blur', () => {
    formatInvestmentInput();
    calculateAndRender();
  });

  expenses.addEventListener('input', () => {
    updateControlOutputs();
    calculateAndRender();
  });

  period.addEventListener('input', () => {
    updateControlOutputs();
    calculateAndRender();
  });

  document.querySelectorAll('input[name="fixedFee"]').forEach(input => {
    input.addEventListener('change', calculateAndRender);
  });

  resultsHead.addEventListener('input', handleTableInteraction);
  resultsHead.addEventListener('click', handleTableInteraction);

  updateControlOutputs();
  formatInvestmentInput();
  calculateAndRender();
}

document.addEventListener('DOMContentLoaded', initialise);
