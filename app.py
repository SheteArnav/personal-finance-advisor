import os
import json
from datetime import datetime, date
from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///finance.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

db = SQLAlchemy(app)

# ─── Models ───────────────────────────────────────────────────────────────────

class Income(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    amount = db.Column(db.Float, nullable=False)
    month = db.Column(db.String(7), nullable=False)  # Format: YYYY-MM
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'amount': self.amount,
            'month': self.month,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class Expense(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    amount = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(50), nullable=False)
    description = db.Column(db.String(200), nullable=True)
    date = db.Column(db.Date, nullable=False, default=date.today)
    month = db.Column(db.String(7), nullable=False)  # Format: YYYY-MM
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'amount': self.amount,
            'category': self.category,
            'description': self.description or '',
            'date': self.date.isoformat() if self.date else None,
            'month': self.month,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


# ─── Constants ────────────────────────────────────────────────────────────────

CATEGORIES = [
    'Food', 'Rent', 'Transport', 'Entertainment',
    'Shopping', 'Education', 'Healthcare', 'Utilities', 'Other'
]

# Budget allocation percentages (of income) per category
BUDGET_RULES = {
    'Rent':          0.30,
    'Food':          0.15,
    'Transport':     0.10,
    'Utilities':     0.08,
    'Healthcare':    0.05,
    'Education':     0.07,
    'Shopping':      0.07,
    'Entertainment': 0.05,
    'Other':         0.05,
    # Savings target: 0.08 (8%) = remaining
}

SAVINGS_TARGET_PCT = 0.20  # Recommend saving at least 20%


# ─── Helpers ──────────────────────────────────────────────────────────────────

def current_month():
    return datetime.now().strftime('%Y-%m')


def get_income(month=None):
    month = month or current_month()
    record = Income.query.filter_by(month=month).first()
    return record.amount if record else 0.0


def get_expenses(month=None, category=None):
    month = month or current_month()
    q = Expense.query.filter_by(month=month)
    if category and category != 'All':
        q = q.filter_by(category=category)
    return q.order_by(Expense.date.desc()).all()


def get_category_totals(month=None):
    month = month or current_month()
    expenses = Expense.query.filter_by(month=month).all()
    totals = {cat: 0.0 for cat in CATEGORIES}
    for e in expenses:
        if e.category in totals:
            totals[e.category] += e.amount
    return totals


def compute_summary(month=None):
    month = month or current_month()
    income = get_income(month)
    expenses = get_expenses(month)
    total_expenses = sum(e.amount for e in expenses)
    savings = income - total_expenses
    savings_pct = (savings / income * 100) if income > 0 else 0.0
    category_totals = get_category_totals(month)
    highest_cat = max(category_totals, key=category_totals.get) if category_totals else None
    return {
        'month': month,
        'income': income,
        'total_expenses': total_expenses,
        'savings': savings,
        'savings_pct': round(savings_pct, 1),
        'num_transactions': len(expenses),
        'category_totals': category_totals,
        'highest_category': highest_cat,
        'highest_category_amount': category_totals.get(highest_cat, 0) if highest_cat else 0
    }


def compute_budget(month=None):
    month = month or current_month()
    income = get_income(month)
    category_totals = get_category_totals(month)
    budget = []
    for cat, pct in BUDGET_RULES.items():
        recommended = income * pct
        actual = category_totals.get(cat, 0.0)
        diff = recommended - actual  # positive = under budget, negative = over
        budget.append({
            'category': cat,
            'recommended': round(recommended, 2),
            'actual': round(actual, 2),
            'difference': round(diff, 2),
            'overspent': diff < 0
        })
    savings_recommended = income * SAVINGS_TARGET_PCT
    total_expenses = sum(e['actual'] for e in budget)
    actual_savings = income - total_expenses
    budget.append({
        'category': 'Savings (Target)',
        'recommended': round(savings_recommended, 2),
        'actual': round(actual_savings, 2),
        'difference': round(actual_savings - savings_recommended, 2),
        'overspent': actual_savings < savings_recommended
    })
    return budget


# ─── Rule-based AI Advisor ────────────────────────────────────────────────────

def generate_rule_based_advice(month=None):
    month = month or current_month()
    summary = compute_summary(month)
    income = summary['income']
    total_expenses = summary['total_expenses']
    savings = summary['savings']
    savings_pct = summary['savings_pct']
    category_totals = summary['category_totals']
    tips = []

    if income == 0:
        return ["Please set your monthly income to receive personalized financial advice."]

    # Savings check
    if savings_pct >= 30:
        tips.append(f"🌟 Excellent! You're saving {savings_pct:.1f}% of your income (₹{savings:,.0f}/month). Keep it up!")
    elif savings_pct >= 20:
        tips.append(f"✅ Good work! You're saving {savings_pct:.1f}% of your income (₹{savings:,.0f}/month). The recommended target is 20%.")
    elif savings_pct >= 0:
        tips.append(f"⚠️ You're saving {savings_pct:.1f}% of your income (₹{savings:,.0f}/month). Try to save at least 20% of your income.")
    else:
        tips.append(f"🚨 Warning: Your expenses exceed your income by ₹{abs(savings):,.0f}. You need to reduce spending immediately.")

    # Per-category advice
    for cat, pct in BUDGET_RULES.items():
        recommended = income * pct
        actual = category_totals.get(cat, 0.0)
        if actual == 0:
            continue
        if actual > recommended * 1.25:
            over_by = actual - recommended
            tips.append(
                f"📊 You spent ₹{actual:,.0f} on {cat} this month, which is ₹{over_by:,.0f} above your suggested limit of ₹{recommended:,.0f}."
            )
        elif actual <= recommended * 0.75 and actual > 0:
            saved_vs_budget = recommended - actual
            tips.append(
                f"👍 Great! You kept {cat} spending to ₹{actual:,.0f}, saving ₹{saved_vs_budget:,.0f} compared to your ₹{recommended:,.0f} budget."
            )

    # Savings boost tip
    if savings > 0 and savings_pct < 20:
        for cat in ['Entertainment', 'Shopping', 'Other']:
            actual = category_totals.get(cat, 0.0)
            if actual > 500:
                reduce_by = round(actual * 0.2, 0)
                tips.append(
                    f"💡 Reducing {cat} expenses by ₹{reduce_by:,.0f} (20%) could increase your monthly savings to ₹{savings + reduce_by:,.0f}."
                )
                break

    # Emergency fund tip
    if savings > 0:
        emergency_fund = income * 6
        tips.append(
            f"🏦 Financial tip: Aim for an emergency fund of ₹{emergency_fund:,.0f} (6 months of income). "
            f"At your current savings rate, you'd reach this in {int(emergency_fund / savings) if savings > 0 else 'N/A'} months."
        )

    # Rent check
    rent = category_totals.get('Rent', 0)
    if rent > income * 0.35:
        tips.append(
            f"🏠 Your rent (₹{rent:,.0f}) is {rent/income*100:.0f}% of your income. Ideally rent should be under 30%."
        )

    if not tips:
        tips.append("📈 Your finances look balanced! Keep tracking your expenses to maintain good financial health.")

    return tips


def generate_ai_advice(month=None):
    """
    Attempts to use the Gemini API if GEMINI_API_KEY is set.
    Falls back to rule-based advice if API key is not available.
    """
    api_key = os.environ.get('GEMINI_API_KEY', '').strip()
    month = month or current_month()
    summary = compute_summary(month)

    if not api_key:
        advice = generate_rule_based_advice(month)
        return {
            'source': 'rule-based',
            'advice': advice,
            'note': 'Set GEMINI_API_KEY in your .env file to enable AI-powered advice.'
        }

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')

        prompt = f"""You are a helpful personal finance advisor. Analyze the following financial data for the month of {month} and provide 5-7 specific, actionable, friendly financial tips in simple language. Use Indian Rupee (₹) symbol.

Monthly Income: ₹{summary['income']:,.0f}
Total Expenses: ₹{summary['total_expenses']:,.0f}
Savings: ₹{summary['savings']:,.0f}
Savings Percentage: {summary['savings_pct']:.1f}%

Spending by category:
{json.dumps(summary['category_totals'], indent=2)}

Budget guidelines used:
- Rent: 30%, Food: 15%, Transport: 10%, Utilities: 8%, Healthcare: 5%, Education: 7%, Shopping: 7%, Entertainment: 5%, Other: 5%, Savings target: 20%

Provide practical, friendly advice. Each tip should be 1-2 sentences. Start each tip with an emoji. Do NOT give generic advice - reference the actual numbers above."""

        response = model.generate_content(prompt)
        advice_text = response.text.strip()
        # Split into individual tips by line
        advice_lines = [line.strip() for line in advice_text.split('\n') if line.strip()]
        return {
            'source': 'gemini-ai',
            'advice': advice_lines,
            'note': 'Powered by Google Gemini AI'
        }
    except Exception as e:
        advice = generate_rule_based_advice(month)
        return {
            'source': 'rule-based',
            'advice': advice,
            'note': f'AI unavailable ({str(e)[:60]}). Showing rule-based advice.'
        }


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html', categories=CATEGORIES)


# Income endpoints
@app.route('/api/income', methods=['GET'])
def api_get_income():
    month = request.args.get('month', current_month())
    record = Income.query.filter_by(month=month).first()
    return jsonify({'income': record.amount if record else 0.0, 'month': month})


@app.route('/api/income', methods=['POST'])
def api_set_income():
    data = request.get_json()
    if not data or 'amount' not in data:
        return jsonify({'error': 'Amount is required'}), 400
    try:
        amount = float(data['amount'])
        if amount < 0:
            return jsonify({'error': 'Income cannot be negative'}), 400
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid amount'}), 400

    month = data.get('month', current_month())
    record = Income.query.filter_by(month=month).first()
    if record:
        record.amount = amount
        record.updated_at = datetime.utcnow()
    else:
        record = Income(amount=amount, month=month)
        db.session.add(record)
    db.session.commit()
    return jsonify({'success': True, 'income': record.to_dict()})


# Expense endpoints
@app.route('/api/expenses', methods=['GET'])
def api_get_expenses():
    month = request.args.get('month', current_month())
    category = request.args.get('category', 'All')
    expenses = get_expenses(month=month, category=category)
    return jsonify({'expenses': [e.to_dict() for e in expenses]})


@app.route('/api/expenses', methods=['POST'])
def api_add_expense():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    required = ['amount', 'category']
    for field in required:
        if field not in data or data[field] is None or str(data[field]).strip() == '':
            return jsonify({'error': f'{field} is required'}), 400

    try:
        amount = float(data['amount'])
        if amount <= 0:
            return jsonify({'error': 'Amount must be greater than zero'}), 400
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid amount'}), 400

    category = data['category'].strip()
    if category not in CATEGORIES:
        return jsonify({'error': f'Invalid category. Choose from: {", ".join(CATEGORIES)}'}), 400

    description = data.get('description', '').strip()[:200]

    try:
        expense_date = datetime.strptime(data['date'], '%Y-%m-%d').date() if data.get('date') else date.today()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

    month = expense_date.strftime('%Y-%m')
    expense = Expense(
        amount=amount,
        category=category,
        description=description,
        date=expense_date,
        month=month
    )
    db.session.add(expense)
    db.session.commit()
    return jsonify({'success': True, 'expense': expense.to_dict()}), 201


@app.route('/api/expenses/<int:expense_id>', methods=['DELETE'])
def api_delete_expense(expense_id):
    expense = Expense.query.get(expense_id)
    if not expense:
        return jsonify({'error': 'Expense not found'}), 404
    db.session.delete(expense)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Expense deleted'})


# Dashboard / Summary endpoints
@app.route('/api/summary', methods=['GET'])
def api_summary():
    month = request.args.get('month', current_month())
    summary = compute_summary(month)
    return jsonify(summary)


@app.route('/api/budget', methods=['GET'])
def api_budget():
    month = request.args.get('month', current_month())
    budget = compute_budget(month)
    income = get_income(month)
    return jsonify({'budget': budget, 'income': income, 'month': month})


@app.route('/api/ai-advice', methods=['GET'])
def api_ai_advice():
    month = request.args.get('month', current_month())
    result = generate_ai_advice(month)
    return jsonify(result)


@app.route('/api/categories', methods=['GET'])
def api_categories():
    return jsonify({'categories': CATEGORIES})


@app.route('/api/months', methods=['GET'])
def api_months():
    """Return list of months that have data."""
    income_months = {r.month for r in Income.query.all()}
    expense_months = {e.month for e in Expense.query.with_entities(Expense.month).distinct()}
    months = sorted(income_months | expense_months, reverse=True)
    if not months or current_month() not in months:
        months = [current_month()] + months
    return jsonify({'months': months})


# ─── Entry Point ──────────────────────────────────────────────────────────────

with app.app_context():
    db.create_all()

if __name__ == '__main__':
    debug_mode = os.environ.get('FLASK_DEBUG', 'True').lower() == 'true'
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=debug_mode, port=port)
