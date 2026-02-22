/**
 * Unit tests for the weighted split logic.
 * Run with: node tests/split.test.js
 *
 * Rules:
 *   - All 4 beneficiaries + non-flight: Claudio=1.25, Claudeane=1.25,
 *       Lucileide=1.0, Jhemerson=0.5
 *   - All 4 beneficiaries + flight: equal split (weight = 1 each)
 *   - Subset (not all 4): equal split always (1/n), regardless of category
 */

// ── Replicated logic from payments.html ─────────────────────────────────────

const ALL_FOUR_NAMES = ['Claudio', 'Claudeane', 'Lucileide', 'Jhemerson'];

const PEOPLE_MAP = {
  Claudio:   { weight: 1.0 },
  Claudeane: { weight: 1.0 },
  Lucileide: { weight: 1.0 },
  Jhemerson: { weight: 0.5 },
};

// parseBrl replicated here (assets/public.js is a browser ES module; Node.js
// tests cannot import it directly without a bundler).
function parseBrl(val) {
  if (val == null) return null;
  if (typeof val === 'number') return val;
  const s = String(val).trim();
  if (s.includes(',')) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  }
  return parseFloat(s);
}

function getEffectiveWeight(name, isAllFour, category) {
  if (!isAllFour || category === 'flight') return 1.0;
  if (name === 'Claudio' || name === 'Claudeane') return 1.25;
  if (name === 'Jhemerson') return 0.5;
  return 1.0; // Lucileide
}

function computeSplit(expense, peopleMap) {
  const beneficiaries = expense.beneficiaries || [];
  const category = expense.category || '';
  const bSet = new Set(beneficiaries);
  const isAllFour =
    bSet.size === ALL_FOUR_NAMES.length && ALL_FOUR_NAMES.every(n => bSet.has(n));

  const totalWeight = beneficiaries.reduce(
    (s, name) => s + getEffectiveWeight(name, isAllFour, category), 0);
  if (totalWeight === 0) return {};

  const amtBrl = parseBrl(expense.amount_brl);
  const shares = {};
  beneficiaries.forEach(name => {
    const w = getEffectiveWeight(name, isAllFour, category);
    shares[name] = {
      chf: expense.amount_chf ? expense.amount_chf * w / totalWeight : 0,
      brl: amtBrl ? amtBrl * w / totalWeight : 0,
    };
  });
  return shares;
}

// ── Helper ───────────────────────────────────────────────────────────────────

let passed = 0, failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

function approxEq(a, b, eps = 1e-9) {
  return Math.abs(a - b) < eps;
}

// ── Tests ────────────────────────────────────────────────────────────────────

// 1. All 4 beneficiaries → weights 1.25 / 1.25 / 1.0 / 0.5
console.log('\nTest 1: all 4 beneficiaries → special weights 1.25/1.25/1.0/0.5');
{
  const expense = {
    amount_chf: 400,
    beneficiaries: ['Claudio', 'Claudeane', 'Lucileide', 'Jhemerson'],
  };
  // total weight = 1.25+1.25+1.0+0.5 = 4.0
  const shares = computeSplit(expense, PEOPLE_MAP);
  assert(approxEq(shares.Claudio.chf, 400 * 1.25 / 4.0),
    `Claudio share = ${shares.Claudio.chf.toFixed(4)} (expected ${(400 * 1.25 / 4.0).toFixed(4)})`);
  assert(approxEq(shares.Claudeane.chf, 400 * 1.25 / 4.0),
    `Claudeane share = ${shares.Claudeane.chf.toFixed(4)} (expected ${(400 * 1.25 / 4.0).toFixed(4)})`);
  assert(approxEq(shares.Lucileide.chf, 400 * 1.0 / 4.0),
    `Lucileide share = ${shares.Lucileide.chf.toFixed(4)} (expected ${(400 * 1.0 / 4.0).toFixed(4)})`);
  assert(approxEq(shares.Jhemerson.chf, 400 * 0.5 / 4.0),
    `Jhemerson share = ${shares.Jhemerson.chf.toFixed(4)} (expected ${(400 * 0.5 / 4.0).toFixed(4)})`);
  // Verify sum equals total
  const sum = Object.values(shares).reduce((a, s) => a + s.chf, 0);
  assert(approxEq(sum, 400), `shares sum to total (${sum.toFixed(4)} ≈ 400)`);
}

// 1b. All 4 beneficiaries + flight → equal split (everyone weight = 1)
console.log('\nTest 1b: all 4 beneficiaries + flight → equal split');
{
  const expense = {
    category: 'flight',
    amount_chf: 400,
    beneficiaries: ['Claudio', 'Claudeane', 'Lucileide', 'Jhemerson'],
  };
  // All 4 + flight → equal split: each = 400/4 = 100
  const shares = computeSplit(expense, PEOPLE_MAP);
  assert(approxEq(shares.Claudio.chf, 100),
    `Claudio flight share = ${shares.Claudio.chf.toFixed(4)} (expected 100, equal split)`);
  assert(approxEq(shares.Claudeane.chf, 100),
    `Claudeane flight share = ${shares.Claudeane.chf.toFixed(4)} (expected 100, equal split)`);
  assert(approxEq(shares.Lucileide.chf, 100),
    `Lucileide flight share = ${shares.Lucileide.chf.toFixed(4)} (expected 100, equal split)`);
  assert(approxEq(shares.Jhemerson.chf, 100),
    `Jhemerson flight share = ${shares.Jhemerson.chf.toFixed(4)} (expected 100, equal split)`);
  // Confirm Claudio does NOT use 1.25 weight for all-4 flights
  assert(!approxEq(shares.Claudio.chf, 400 * 1.25 / 4.5),
    `Claudio does NOT use 1.25 weight for all-4 flights`);
}

// 2. Only {Claudio, Claudeane} → equal split (1/2 each)
console.log('\nTest 2: {Claudio, Claudeane} only → equal split');
{
  const expense = { amount_chf: 200, beneficiaries: ['Claudio', 'Claudeane'] };
  // Not all 4 → equal split: each = 200/2 = 100
  const shares = computeSplit(expense, PEOPLE_MAP);
  assert(approxEq(shares.Claudio.chf, 100),
    `Claudio share = ${shares.Claudio.chf.toFixed(4)} (expected 100)`);
  assert(approxEq(shares.Claudeane.chf, 100),
    `Claudeane share = ${shares.Claudeane.chf.toFixed(4)} (expected 100)`);
}

// 3. {Claudio, Lucileide, Jhemerson} → equal split (not all 4)
console.log('\nTest 3: {Claudio, Lucileide, Jhemerson} → equal split (not all 4)');
{
  const expense = {
    amount_chf: 250,
    beneficiaries: ['Claudio', 'Lucileide', 'Jhemerson'],
  };
  // Not all 4 → equal split: each = 250/3
  const shares = computeSplit(expense, PEOPLE_MAP);
  const expectedEach = 250 / 3;
  assert(approxEq(shares.Claudio.chf, expectedEach),
    `Claudio share = ${shares.Claudio.chf.toFixed(4)} (expected ${expectedEach.toFixed(4)} equal split)`);
  assert(approxEq(shares.Lucileide.chf, expectedEach),
    `Lucileide share = ${shares.Lucileide.chf.toFixed(4)} (expected ${expectedEach.toFixed(4)} equal split)`);
  assert(approxEq(shares.Jhemerson.chf, expectedEach),
    `Jhemerson share = ${shares.Jhemerson.chf.toFixed(4)} (expected ${expectedEach.toFixed(4)} equal split)`);
  // Confirm Claudio does NOT use old weighted value (100 = 250 × 1.0 / 2.5)
  assert(!approxEq(shares.Claudio.chf, 100),
    `Claudio share is NOT the old weighted value (100 = 250×1.0/2.5) — uses equal split`);
}

// ── getEffectivePaidRatio (mirrors payments.html) ────────────────────────────
// Priority rule: status ✅ → 1; paid_ratio wins over paid_amount; else derive
// from paid_amount; else 0.

function getEffectivePaidRatio(exp) {
  if ((exp.status || '').startsWith('✅')) return 1;
  if (exp.paid_ratio != null) return Math.min(1, Math.max(0, Number(exp.paid_ratio)));
  if (exp.paid_amount != null) {
    const amount = parseBrl(exp.amount_brl) || exp.amount_chf || 0;
    if (amount > 0) return Math.min(1, Math.max(0, Number(exp.paid_amount) / amount));
  }
  return 0;
}

// ── computePaidSummary (replicated from payments.html fix) ───────────────────

function computePaidSummary(expenses, people, peopleMap) {
  const paidTotals = {};
  people.forEach(p => { paidTotals[p.name] = { chf: 0, brl: 0 }; });
  expenses.forEach(exp => {
    const ratio = getEffectivePaidRatio(exp);
    if (ratio > 0) {
      const shares = computeSplit(exp, peopleMap);
      Object.entries(shares).forEach(([name, s]) => {
        if (paidTotals[name]) {
          paidTotals[name].chf += s.chf * ratio;
          paidTotals[name].brl += s.brl * ratio;
        }
      });
    }
  });
  return paidTotals;
}

// computeTotalSummary — mirrors COTA TOTAL (all expenses, no status filter)
function computeTotalSummary(expenses, people, peopleMap) {
  const totals = {};
  people.forEach(p => { totals[p.name] = { chf: 0, brl: 0 }; });
  expenses.forEach(exp => {
    const shares = computeSplit(exp, peopleMap);
    Object.entries(shares).forEach(([name, s]) => {
      if (totals[name]) {
        totals[name].chf += s.chf;
        totals[name].brl += s.brl;
      }
    });
  });
  return totals;
}

const ALL_PEOPLE = Object.keys(PEOPLE_MAP).map(name => ({ name, ...PEOPLE_MAP[name] }));

// 4. Paid BRL expenses reflected in paidTotals for Lucileide/Jhemerson
console.log('\nTest 4: paid BRL expenses show in paidTotals for Lucileide/Jhemerson');
{
  const expenses = [
    { amount_chf: null, amount_brl: 1300.17, status: '✅ Payé',
      beneficiaries: ['Claudeane', 'Lucileide', 'Jhemerson'] },
    { amount_chf: null, amount_brl: 799.14,  status: '✅ Payé',
      beneficiaries: ['Claudeane', 'Lucileide', 'Jhemerson'] },
    { amount_chf: null, amount_brl: 3132.3,  status: '⚠️ À PAYER',
      beneficiaries: ['Claudio'] },
  ];
  const paidTotals = computePaidSummary(expenses, ALL_PEOPLE, PEOPLE_MAP);

  // Not all 4 → equal split: each of 3 gets 1/3
  const expectedEach = (1300.17 + 799.14) / 3;

  assert(paidTotals.Lucileide.brl > 0,
    `Lucileide paid BRL > 0 (was 0 before fix, got ${paidTotals.Lucileide.brl.toFixed(4)})`);
  assert(approxEq(paidTotals.Lucileide.brl, expectedEach, 1e-6),
    `Lucileide paid BRL = ${paidTotals.Lucileide.brl.toFixed(4)} (expected ${expectedEach.toFixed(4)} equal split)`);
  assert(paidTotals.Jhemerson.brl > 0,
    `Jhemerson paid BRL > 0 (was 0 before fix, got ${paidTotals.Jhemerson.brl.toFixed(4)})`);
  assert(approxEq(paidTotals.Jhemerson.brl, expectedEach, 1e-6),
    `Jhemerson paid BRL = ${paidTotals.Jhemerson.brl.toFixed(4)} (expected ${expectedEach.toFixed(4)} equal split)`);
  assert(approxEq(paidTotals.Claudio.brl, 0),
    'Unpaid expense not counted in paidTotals for Claudio');
}

// 5. Unpaid expenses are excluded from paidTotals
console.log('\nTest 5: unpaid (❌/⚠️) expenses excluded from paidTotals');
{
  const expenses = [
    { amount_chf: 100, amount_brl: null, status: '❌ NON PAYÉ', beneficiaries: ['Claudio'] },
    { amount_chf: 200, amount_brl: null, status: '✅ Payé',    beneficiaries: ['Claudio'] },
    { amount_chf: 50,  amount_brl: null, status: '⚠️ À PAYER', beneficiaries: ['Claudio'] },
  ];
  const paidTotals = computePaidSummary(expenses, ALL_PEOPLE, PEOPLE_MAP);
  assert(approxEq(paidTotals.Claudio.chf, 200),
    `Claudio paid CHF = ${paidTotals.Claudio.chf} (expected 200, only ✅ expense counted)`);
}

// 6. Transport expense included in COTA TOTAL regardless of status
console.log('\nTest 6: transport expense included in COTA TOTAL regardless of status');
{
  const expenses = [
    { category: 'transport', amount_chf: null, amount_brl: 3132.3,
      status: '⚠️ À PAYER', beneficiaries: ['Claudio'] },
  ];
  const totals = computeTotalSummary(expenses, ALL_PEOPLE, PEOPLE_MAP);
  assert(approxEq(totals.Claudio.brl, 3132.3),
    `Transport (rental car) in COTA TOTAL: Claudio = ${totals.Claudio.brl.toFixed(2)} BRL (expected 3132.30)`);
  // Ensure it is NOT in paidTotals (⚠️ status)
  const paidTotals = computePaidSummary(expenses, ALL_PEOPLE, PEOPLE_MAP);
  assert(approxEq(paidTotals.Claudio.brl, 0),
    `Unpaid transport not in JÁ PAGO: Claudio paid = ${paidTotals.Claudio.brl} (expected 0)`);
}

// 7. BRL string parsing handles pt-BR format ("3.182,3")
console.log('\nTest 7: parseBrl handles pt-BR number format');
{
  assert(approxEq(parseBrl('3.182,3'), 3182.3),
    `parseBrl('3.182,3') = ${parseBrl('3.182,3')} (expected 3182.3)`);
  assert(approxEq(parseBrl('3.132,30'), 3132.30),
    `parseBrl('3.132,30') = ${parseBrl('3.132,30')} (expected 3132.30)`);
  assert(approxEq(parseBrl(3132.3), 3132.3),
    `parseBrl(3132.3 number) = ${parseBrl(3132.3)} (expected 3132.3)`);
  assert(parseBrl(null) === null,
    'parseBrl(null) = null');

  // Verify BRL string used in computeSplit
  const expense = {
    category: 'transport',
    amount_brl: '3.132,30',
    beneficiaries: ['Claudio'],
  };
  const shares = computeSplit(expense, PEOPLE_MAP);
  assert(approxEq(shares.Claudio.brl, 3132.30),
    `computeSplit with BRL string '3.132,30': Claudio = ${shares.Claudio.brl.toFixed(2)} (expected 3132.30)`);
}

// 8. Subset + flight → equal split (Jhemerson regression)
console.log('\nTest 8: subset + flight → equal split (Jhemerson regression)');
{
  const expense = {
    category: 'flight',
    amount_brl: 1300.17,
    beneficiaries: ['Claudeane', 'Lucileide', 'Jhemerson'],
  };
  // Not all 4 → equal split: each = 1300.17/3
  const shares = computeSplit(expense, PEOPLE_MAP);
  const expected = 1300.17 / 3.0;
  assert(approxEq(shares.Jhemerson.brl, expected, 1e-6),
    `Jhemerson flight share = ${shares.Jhemerson.brl.toFixed(4)} (expected ${expected.toFixed(4)} equal split)`);
  assert(approxEq(shares.Claudeane.brl, expected, 1e-6),
    `Claudeane flight share = ${shares.Claudeane.brl.toFixed(4)} (expected ${expected.toFixed(4)})`);
  assert(approxEq(shares.Lucileide.brl, expected, 1e-6),
    `Lucileide flight share = ${shares.Lucileide.brl.toFixed(4)} (expected ${expected.toFixed(4)})`);
  // Confirm it's NOT the old 0.5-weight value
  const oldValue = 1300.17 * 0.5 / 2.5;
  assert(!approxEq(shares.Jhemerson.brl, oldValue, 1e-6),
    `Jhemerson NOT using old 0.5 weight for flight (old value was ${oldValue.toFixed(4)})`);
}

// 9. Subset + non-flight → equal split (Jhemerson does NOT get 0.5 weight)
console.log('\nTest 9: subset + lodging → equal split (Jhemerson not weighted 0.5)');
{
  const expense = {
    category: 'lodging',
    amount_chf: 200,
    beneficiaries: ['Claudeane', 'Lucileide', 'Jhemerson'],
  };
  // Not all 4 → equal split: each = 200/3
  const shares = computeSplit(expense, PEOPLE_MAP);
  const expectedEach = 200 / 3;
  assert(approxEq(shares.Jhemerson.chf, expectedEach, 1e-6),
    `Jhemerson lodging share = ${shares.Jhemerson.chf.toFixed(4)} (expected ${expectedEach.toFixed(4)} equal split)`);
  // Confirm it's NOT the old 0.5-weight value (40)
  const oldValue = 200 * 0.5 / 2.5; // = 40
  assert(!approxEq(shares.Jhemerson.chf, oldValue, 1e-6),
    `Jhemerson NOT using old 0.5 weight for lodging subset (old value was ${oldValue.toFixed(4)})`);
}

// ── Partial payment tests ─────────────────────────────────────────────────────

// 10. paid_ratio=0.5 → JÁ PAGO reflects 50% of each beneficiary share
console.log('\nTest 10: paid_ratio=0.5 → JÁ PAGO = 50% of shares');
{
  const expenses = [
    {
      amount_chf: null, amount_brl: 1000,
      status: '⚠️ À PAYER',
      paid_ratio: 0.5,
      beneficiaries: ['Claudio'],
    },
  ];
  const paidTotals = computePaidSummary(expenses, ALL_PEOPLE, PEOPLE_MAP);
  assert(approxEq(paidTotals.Claudio.brl, 500, 1e-6),
    `Claudio JÁ PAGO BRL = ${paidTotals.Claudio.brl.toFixed(4)} (expected 500, 50% of 1000)`);
}

// 11. paid_ratio takes priority over paid_amount when both are present
console.log('\nTest 11: paid_ratio priority over paid_amount');
{
  const expenses = [
    {
      amount_chf: null, amount_brl: 1000,
      status: '⚠️ À PAYER',
      paid_ratio: 0.5,   // 50% → 500 BRL
      paid_amount: 800,  // would be 80% if used — must be ignored
      beneficiaries: ['Claudio'],
    },
  ];
  const paidTotals = computePaidSummary(expenses, ALL_PEOPLE, PEOPLE_MAP);
  assert(approxEq(paidTotals.Claudio.brl, 500, 1e-6),
    `paid_ratio wins: Claudio JÁ PAGO BRL = ${paidTotals.Claudio.brl.toFixed(4)} (expected 500, not 800)`);
  assert(!approxEq(paidTotals.Claudio.brl, 800, 1e-6),
    'paid_amount (800) was NOT used when paid_ratio is present');
}

// 12. paid_amount only → derives ratio when no paid_ratio present
console.log('\nTest 12: paid_amount only → derives paid ratio');
{
  const expenses = [
    {
      amount_chf: null, amount_brl: 1000,
      status: '⚠️ À PAYER',
      paid_amount: 300,  // 30%
      beneficiaries: ['Claudio'],
    },
  ];
  const paidTotals = computePaidSummary(expenses, ALL_PEOPLE, PEOPLE_MAP);
  assert(approxEq(paidTotals.Claudio.brl, 300, 1e-6),
    `paid_amount derives ratio: Claudio JÁ PAGO BRL = ${paidTotals.Claudio.brl.toFixed(4)} (expected 300)`);
}

// 13. getEffectivePaidRatio: ✅ status always returns 1 regardless of paid_ratio or paid_amount
console.log('\nTest 13: ✅ status → ratio=1 regardless of paid_ratio or paid_amount');
{
  const expWithRatio = { amount_brl: 1000, status: '✅ Payé', paid_ratio: 0.3 };
  assert(approxEq(getEffectivePaidRatio(expWithRatio), 1),
    `✅ status with paid_ratio → ratio = ${getEffectivePaidRatio(expWithRatio)} (expected 1)`);

  const expWithAmount = { amount_brl: 1000, status: '✅ Payé', paid_amount: 400 };
  assert(approxEq(getEffectivePaidRatio(expWithAmount), 1),
    `✅ status with paid_amount → ratio = ${getEffectivePaidRatio(expWithAmount)} (expected 1, not 0.4)`);
}

// 14. Partial payment with multiple beneficiaries (subset → equal split)
console.log('\nTest 14: partial payment split across multiple beneficiaries (equal split)');
{
  const expenses = [
    {
      amount_chf: null, amount_brl: 1000,
      status: '⚠️ À PAYER',
      paid_ratio: 0.5,
      beneficiaries: ['Claudeane', 'Lucileide', 'Jhemerson'],
      category: 'lodging',
    },
  ];
  // Not all 4 → equal split: each = 1000/3
  // paid (×0.5): each = 500/3 ≈ 166.67
  const expectedEach = 1000 / 3 * 0.5;
  const paidTotals = computePaidSummary(expenses, ALL_PEOPLE, PEOPLE_MAP);
  assert(approxEq(paidTotals.Claudeane.brl, expectedEach, 1e-6),
    `Claudeane JÁ PAGO BRL = ${paidTotals.Claudeane.brl.toFixed(4)} (expected ${expectedEach.toFixed(4)} equal split)`);
  assert(approxEq(paidTotals.Lucileide.brl, expectedEach, 1e-6),
    `Lucileide JÁ PAGO BRL = ${paidTotals.Lucileide.brl.toFixed(4)} (expected ${expectedEach.toFixed(4)} equal split)`);
  assert(approxEq(paidTotals.Jhemerson.brl, expectedEach, 1e-6),
    `Jhemerson JÁ PAGO BRL = ${paidTotals.Jhemerson.brl.toFixed(4)} (expected ${expectedEach.toFixed(4)} equal split)`);
}

// ── brlSecondary display logic ────────────────────────────────────────────────
// The helper in payments.html computes two separate lines:
//   converted = chfAmt × convRate   (CHF portion converted to BRL at applicable rate)
//   receipt   = brlAmt              (native BRL portion, no conversion)
//   total     = converted + receipt (shown only when both are non-zero)
//
// For 'paid' rows the fallbackRate is used; for 'due'/'remaining' the live rate.

function brlSecondaryData(chfAmt, brlAmt, convRate) {
  const converted = chfAmt * convRate;
  const showConverted = converted > 0.005;
  const showReceipt   = brlAmt > 0.005;
  return {
    converted: showConverted ? converted : null,
    receipt:   showReceipt   ? brlAmt    : null,
    total:     (showConverted && showReceipt) ? converted + brlAmt : null,
  };
}

// 15. CHF-only expense: converted line = chf × rate; no receipt line
console.log('\nTest 15: CHF-only → converted line only, no receipt');
{
  const chf = 125;
  const rate = 6.5;
  const d = brlSecondaryData(chf, 0, rate);
  assert(approxEq(d.converted, chf * rate, 1e-6),
    `converted = ${d.converted?.toFixed(4)} (expected ${(chf * rate).toFixed(4)})`);
  assert(d.receipt === null,
    `receipt is null when brlAmt = 0 (got ${d.receipt})`);
  assert(d.total === null,
    `total is null when only one side is non-zero (got ${d.total})`);
}

// 16. BRL-only expense: receipt line = brlAmt; no converted line
console.log('\nTest 16: BRL-only → receipt line only, no converted');
{
  const brl = 500;
  const d = brlSecondaryData(0, brl, 6.5);
  assert(d.converted === null,
    `converted is null when chfAmt = 0 (got ${d.converted})`);
  assert(approxEq(d.receipt, brl, 1e-6),
    `receipt = ${d.receipt?.toFixed(4)} (expected ${brl})`);
  assert(d.total === null,
    `total is null when only one side is non-zero (got ${d.total})`);
}

// 17. Mixed CHF + BRL: both lines shown + total = sum
console.log('\nTest 17: mixed CHF+BRL → both lines + total');
{
  const chf = 100, brl = 200, rate = 6.7;
  const d = brlSecondaryData(chf, brl, rate);
  const expectedConverted = chf * rate; // 670
  const expectedTotal     = expectedConverted + brl; // 870
  assert(approxEq(d.converted, expectedConverted, 1e-6),
    `converted = ${d.converted?.toFixed(4)} (expected ${expectedConverted.toFixed(4)})`);
  assert(approxEq(d.receipt, brl, 1e-6),
    `receipt = ${d.receipt?.toFixed(4)} (expected ${brl})`);
  assert(approxEq(d.total, expectedTotal, 1e-6),
    `total = ${d.total?.toFixed(4)} (expected ${expectedTotal.toFixed(4)})`);
  // Confirm no double-counting: total != 2 × converted, total != 2 × receipt
  assert(!approxEq(d.total, 2 * d.converted, 1e-6),
    'total is not double the converted portion');
  assert(!approxEq(d.total, 2 * d.receipt, 1e-6),
    'total is not double the receipt portion');
}

// 18. Paid line uses fallbackRate, due/remaining use live rate
console.log('\nTest 18: paid uses fallbackRate; due/remaining use live rate');
{
  const chf = 100, brl = 50;
  const liveRate = 6.8, fallbackRate = 6.5;
  const dDue  = brlSecondaryData(chf, brl, liveRate);
  const dPaid = brlSecondaryData(chf, brl, fallbackRate);
  assert(approxEq(dDue.converted,  chf * liveRate,     1e-6),
    `due converted uses live rate: ${dDue.converted?.toFixed(4)} (expected ${(chf * liveRate).toFixed(4)})`);
  assert(approxEq(dPaid.converted, chf * fallbackRate, 1e-6),
    `paid converted uses fallbackRate: ${dPaid.converted?.toFixed(4)} (expected ${(chf * fallbackRate).toFixed(4)})`);
  assert(!approxEq(dDue.converted, dPaid.converted, 1e-6),
    'live rate and fallback rate produce different converted values');
  // receipt (BRL native) is rate-independent
  assert(approxEq(dDue.receipt, dPaid.receipt, 1e-6),
    `receipt is rate-independent: due=${dDue.receipt?.toFixed(4)} paid=${dPaid.receipt?.toFixed(4)}`);
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} test(s): ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
