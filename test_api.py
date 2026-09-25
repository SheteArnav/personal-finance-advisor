"""
Automated test script for Personal Finance Advisor Bot.
Run: python test_api.py
"""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
import urllib.request
import json
import sys

BASE = 'http://127.0.0.1:5000'
PASSED = 0
FAILED = 0

def get(path):
    with urllib.request.urlopen(BASE + path) as r:
        return json.loads(r.read())

def post(path, data):
    payload = json.dumps(data).encode()
    req = urllib.request.Request(BASE + path, payload, {'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def delete(path):
    req = urllib.request.Request(BASE + path, method='DELETE')
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def check(name, condition, detail=''):
    global PASSED, FAILED
    if condition:
        print(f'  ✓ {name}')
        PASSED += 1
    else:
        print(f'  ✗ {name} — {detail}')
        FAILED += 1

month = '2026-09'

# ── Test 1: Home page ──────────────────────────────
print('\n=== TEST 1: Home page ===')
try:
    with urllib.request.urlopen(BASE + '/') as r:
        check('GET / returns 200', r.status == 200)
        html = r.read().decode()
        check('Page contains Finance Advisor', 'Finance Advisor' in html)
except Exception as e:
    check('GET / reachable', False, str(e))

# ── Test 2: Categories ─────────────────────────────
print('\n=== TEST 2: Categories ===')
cats = get('/api/categories')
check('Categories endpoint', 'categories' in cats)
check('Has 9 categories', len(cats['categories']) == 9)
check('Food in categories', 'Food' in cats['categories'])
check('Rent in categories', 'Rent' in cats['categories'])

# ── Test 3: Set income ─────────────────────────────
print('\n=== TEST 3: Set income ===')
r = post('/api/income', {'amount': 25000, 'month': month})
check('Set income success', r.get('success') == True)
check('Income amount correct', r['income']['amount'] == 25000.0)

# Update income
r2 = post('/api/income', {'amount': 28000, 'month': month})
check('Update income', r2['income']['amount'] == 28000.0)

# ── Test 4: Get income ─────────────────────────────
print('\n=== TEST 4: Get income ===')
r = get(f'/api/income?month={month}')
check('Get income', r['income'] == 28000.0)
check('Month matches', r['month'] == month)

# ── Test 5: Add expenses ───────────────────────────
print('\n=== TEST 5: Add expenses ===')
exps = [
    {'amount': 7500, 'category': 'Rent',          'description': 'Monthly rent',       'date': '2026-09-01'},
    {'amount': 3800, 'category': 'Food',           'description': 'Groceries',          'date': '2026-09-05'},
    {'amount': 2000, 'category': 'Transport',      'description': 'Petrol',             'date': '2026-09-10'},
    {'amount': 3500, 'category': 'Entertainment',  'description': 'Movies',             'date': '2026-09-15'},
    {'amount': 1200, 'category': 'Utilities',      'description': 'Electricity',        'date': '2026-09-20'},
]
ids = []
for e in exps:
    r = post('/api/expenses', e)
    check(f'Add {e["category"]} expense', r.get('success') == True)
    ids.append(r['expense']['id'])

# ── Test 6: Validation ─────────────────────────────
print('\n=== TEST 6: Input validation ===')
try:
    post('/api/expenses', {'amount': -100, 'category': 'Food', 'date': '2026-09-01'})
    check('Reject negative amount', False, 'Should have failed')
except urllib.error.HTTPError as e:
    check('Reject negative amount', e.code == 400)

try:
    post('/api/expenses', {'amount': 100, 'category': 'Invalid', 'date': '2026-09-01'})
    check('Reject invalid category', False, 'Should have failed')
except urllib.error.HTTPError as e:
    check('Reject invalid category', e.code == 400)

try:
    post('/api/expenses', {})
    check('Reject empty body', False, 'Should have failed')
except urllib.error.HTTPError as e:
    check('Reject empty body', e.code == 400)

# ── Test 7: Get expenses ───────────────────────────
print('\n=== TEST 7: Get & filter expenses ===')
r = get(f'/api/expenses?month={month}')
check('Get all expenses', len(r['expenses']) == 5)

r2 = get(f'/api/expenses?month={month}&category=Food')
check('Filter by category', len(r2['expenses']) == 1)
check('Filter returns correct category', r2['expenses'][0]['category'] == 'Food')

# ── Test 8: Dashboard summary ──────────────────────
print('\n=== TEST 8: Dashboard summary ===')
s = get(f'/api/summary?month={month}')
check('Summary income', s['income'] == 28000.0)
check('Summary total_expenses', s['total_expenses'] == 18000.0)
check('Summary savings', s['savings'] == 10000.0)
check('Summary savings_pct', s['savings_pct'] == 35.7)
check('Summary num_transactions', s['num_transactions'] == 5)
check('Summary highest_category is Rent', s['highest_category'] == 'Rent')
check('Category totals exist', 'category_totals' in s)

print(f'\n  Income: Rs.{s["income"]}')
print(f'  Total Expenses: Rs.{s["total_expenses"]}')
print(f'  Savings: Rs.{s["savings"]}')
print(f'  Savings Rate: {s["savings_pct"]}%')

# ── Test 9: Budget ─────────────────────────────────
print('\n=== TEST 9: Budget advisor ===')
b = get(f'/api/budget?month={month}')
check('Budget has items', len(b['budget']) > 0)
check('Budget has income', b['income'] == 28000.0)

entertainment_item = next((x for x in b['budget'] if x['category'] == 'Entertainment'), None)
check('Entertainment over budget', entertainment_item and entertainment_item['overspent'] == True)

rent_item = next((x for x in b['budget'] if x['category'] == 'Rent'), None)
check('Rent within budget (28000*0.30=8400 > 7500)', rent_item and rent_item['overspent'] == False)

print('\n  Budget breakdown:')
for item in b['budget']:
    status = '⚠ OVER' if item['overspent'] else '✓ OK'
    print(f'    {item["category"]:20s} rec=Rs.{item["recommended"]:7,.0f}  actual=Rs.{item["actual"]:7,.0f}  {status}')

# ── Test 10: AI Advice ─────────────────────────────
print('\n=== TEST 10: AI/Rule-based advice ===')
a = get(f'/api/ai-advice?month={month}')
check('Advice source is rule-based', a['source'] == 'rule-based')
check('Advice has tips', len(a['advice']) > 0)
check('Has note about API key', 'GEMINI_API_KEY' in a.get('note', ''))

print(f'\n  Source: {a["source"]}')
print(f'  Note: {a["note"]}')
print(f'  Tips ({len(a["advice"])}):')
for tip in a['advice']:
    print(f'    {tip}')

# ── Test 11: Delete expense ────────────────────────
print('\n=== TEST 11: Delete expense ===')
del_id = ids[-1]
r = delete(f'/api/expenses/{del_id}')
check('Delete returns success', r.get('success') == True)

r2 = get(f'/api/expenses?month={month}')
check('Expense deleted from list', len(r2['expenses']) == 4)

# Test delete non-existent
try:
    delete(f'/api/expenses/99999')
    check('Delete non-existent returns 404', False, 'Should have failed')
except urllib.error.HTTPError as e:
    check('Delete non-existent returns 404', e.code == 404)

# ── Test 12: Months list ───────────────────────────
print('\n=== TEST 12: Months list ===')
m = get('/api/months')
check('Months list', 'months' in m)
check(f'Contains {month}', month in m['months'])

# ── Results ────────────────────────────────────────
print(f'\n{"="*50}')
print(f'RESULTS: {PASSED} passed, {FAILED} failed')
if FAILED == 0:
    print('🎉 ALL TESTS PASSED!')
else:
    print('❌ Some tests failed.')
    sys.exit(1)
