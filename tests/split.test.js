/**
 * Unit tests for the weighted split logic (Option B rules).
 * Run with: node tests/split.test.js
 *
 * Rules:
 *   - Default weights: Claudio=1.0, Claudeane=1.0, Lucileide=1.0, Jhemerson=0.5
 *   - When beneficiaries == exactly {Claudio, Claudeane, Lucileide, Jhemerson}:
 *       Claudio=1.25, Claudeane=1.25, Lucileide=1.0, Jhemerson=0.5
 *   - Any other subset: Claudio and Claudeane remain 1.0
 */

// ── Replicated logic from payments.html ─────────────────────────────────────

const ALL_FOUR_NAMES = ['Claudio', 'Claudeane', 'Lucileide', 'Jhemerson'];

const PEOPLE_MAP = {
  Claudio:   { weight: 1.0 },
  Claudeane: { weight: 1.0 },
  Lucileide: { weight: 1.0 },
  Jhemerson: { weight: 0.5 },
};

function getEffectiveWeight(name, isAllFour, peopleMap) {
  if (isAllFour && (name === 'Claudio' || name === 'Claudeane')) return 1.25;
  return peopleMap[name]?.weight ?? 1.0;
}

function computeSplit(expense, peopleMap) {
  const beneficiaries = expense.beneficiaries || [];
  const bSet = new Set(beneficiaries);
  const isAllFour =
    bSet.size === ALL_FOUR_NAMES.length && ALL_FOUR_NAMES.every(n => bSet.has(n));

  const totalWeight = beneficiaries.reduce(
    (s, name) => s + getEffectiveWeight(name, isAllFour, peopleMap), 0);
  if (totalWeight === 0) return {};

  const shares = {};
  beneficiaries.forEach(name => {
    const w = getEffectiveWeight(name, isAllFour, peopleMap);
    shares[name] = {
      chf: expense.amount_chf ? expense.amount_chf * w / totalWeight : 0,
      brl: expense.amount_brl ? expense.amount_brl * w / totalWeight : 0,
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

// 2. Only {Claudio, Claudeane} → weights 1.0 / 1.0
console.log('\nTest 2: {Claudio, Claudeane} only → weights 1.0/1.0');
{
  const expense = { amount_chf: 200, beneficiaries: ['Claudio', 'Claudeane'] };
  // total weight = 1.0+1.0 = 2.0 → each 100
  const shares = computeSplit(expense, PEOPLE_MAP);
  assert(approxEq(shares.Claudio.chf, 100),
    `Claudio share = ${shares.Claudio.chf.toFixed(4)} (expected 100)`);
  assert(approxEq(shares.Claudeane.chf, 100),
    `Claudeane share = ${shares.Claudeane.chf.toFixed(4)} (expected 100)`);
}

// 3. {Claudio, Lucileide, Jhemerson} → Claudio weight is 1.0
console.log('\nTest 3: {Claudio, Lucileide, Jhemerson} → Claudio weight 1.0');
{
  const expense = {
    amount_chf: 250,
    beneficiaries: ['Claudio', 'Lucileide', 'Jhemerson'],
  };
  // total weight = 1.0+1.0+0.5 = 2.5
  const shares = computeSplit(expense, PEOPLE_MAP);
  const expectedClaudio = 250 * 1.0 / 2.5; // = 100
  assert(approxEq(shares.Claudio.chf, expectedClaudio),
    `Claudio share = ${shares.Claudio.chf.toFixed(4)} (expected ${expectedClaudio.toFixed(4)} with weight 1.0)`);
  // Confirm Claudio's effective share is not the 1.25 value
  const wrongValue = 250 * 1.25 / (1.25 + 1.0 + 0.5);
  assert(!approxEq(shares.Claudio.chf, wrongValue),
    `Claudio share is NOT the 1.25-weight value (${wrongValue.toFixed(4)})`);
}

// ── computePaidSummary (replicated from payments.html fix) ───────────────────

function computePaidSummary(expenses, people, peopleMap) {
  const paidTotals = {};
  people.forEach(p => { paidTotals[p.name] = { chf: 0, brl: 0 }; });
  expenses.forEach(exp => {
    if ((exp.status || '').startsWith('✅')) {
      const shares = computeSplit(exp, peopleMap);
      Object.entries(shares).forEach(([name, s]) => {
        if (paidTotals[name]) {
          paidTotals[name].chf += s.chf;
          paidTotals[name].brl += s.brl;
        }
      });
    }
  });
  return paidTotals;
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

  // Weights: Claudeane=1.0, Lucileide=1.0, Jhemerson=0.5 → totalWeight=2.5
  const expectedLucileide = (1300.17 * 1.0 / 2.5) + (799.14 * 1.0 / 2.5);
  const expectedJhemerson = (1300.17 * 0.5 / 2.5) + (799.14 * 0.5 / 2.5);

  assert(paidTotals.Lucileide.brl > 0,
    `Lucileide paid BRL > 0 (was 0 before fix, got ${paidTotals.Lucileide.brl.toFixed(4)})`);
  assert(approxEq(paidTotals.Lucileide.brl, expectedLucileide, 1e-6),
    `Lucileide paid BRL = ${paidTotals.Lucileide.brl.toFixed(4)} (expected ${expectedLucileide.toFixed(4)})`);
  assert(paidTotals.Jhemerson.brl > 0,
    `Jhemerson paid BRL > 0 (was 0 before fix, got ${paidTotals.Jhemerson.brl.toFixed(4)})`);
  assert(approxEq(paidTotals.Jhemerson.brl, expectedJhemerson, 1e-6),
    `Jhemerson paid BRL = ${paidTotals.Jhemerson.brl.toFixed(4)} (expected ${expectedJhemerson.toFixed(4)})`);
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

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} test(s): ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
