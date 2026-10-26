# 📘 Personal Finance Advisor Bot — Technical Documentation

> **Project:** Personal Finance Advisor Bot
> **Author:** SheteArnav
> **GitHub:** [github.com/SheteArnav/personal-finance-advisor](https://github.com/SheteArnav/personal-finance-advisor)
> **Stack:** Python · Flask · SQLAlchemy · SQLite · HTML/CSS/JS · Chart.js

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Architecture](#4-architecture)
5. [Database Schema](#5-database-schema)
6. [API Reference](#6-api-reference)
7. [Budget Rules Engine](#7-budget-rules-engine)
8. [AI Advisor Module](#8-ai-advisor-module)
9. [Frontend Structure](#9-frontend-structure)
10. [Environment Variables](#10-environment-variables)
11. [Installation & Setup](#11-installation--setup)
12. [Deployment Guide](#12-deployment-guide)
13. [Testing](#13-testing)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Project Overview

**Personal Finance Advisor Bot** is a full-stack web application that helps individuals track monthly income and expenses, calculate savings, and receive personalized budget recommendations and financial advice.

### Core Purpose
- Track income and expenses on a per-month basis
- Automatically calculate savings and savings percentage
- Compare spending against recommended budget guidelines
- Generate smart financial advice (rule-based or AI-powered)
- Provide a monthly financial health summary

### Key Design Decisions
- **Single-page application (SPA)** — all 5 sections load without page refresh
- **Month-aware data** — income and expenses are scoped to a `YYYY-MM` month
- **No authentication** — designed as a personal single-user app
- **Graceful AI fallback** — works fully without any API key

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Backend | Python | 3.11+ |
| Web Framework | Flask | 3.0.3 |
| ORM | Flask-SQLAlchemy | 3.1.1 |
| Database | SQLite | (built-in) |
| Frontend | HTML5 / CSS3 / Vanilla JS | — |
| Charts | Chart.js | 4.4.2 (CDN) |
| Fonts | Google Fonts (Inter) | CDN |
| AI (optional) | Google Gemini 1.5 Flash | 0.7.2 |
| Production Server | Gunicorn | 22.0.0 |
| Env Management | python-dotenv | 1.0.1 |

---

## 3. Project Structure

```
personal-finance-advisor/
│
├── app.py                  # Main Flask application
├── requirements.txt        # Python dependencies
├── Procfile                # Render/Heroku deployment command
├── .env.example            # Environment variable template
├── .gitignore              # Files excluded from git
├── README.md               # Project README
├── test_api.py             # Automated API test suite (41 tests)
│
├── templates/
│   └── index.html          # Single-page HTML application
│
├── static/
│   ├── style.css           # Complete stylesheet (CSS variables + responsive)
│   └── script.js           # All client-side JavaScript logic
│
└── instance/
    └── finance.db          # SQLite database (auto-created on first run)
```

---

## 4. Architecture

### Request Flow

1. User interacts with the browser (e.g. clicks "Add Expense")
2. `script.js` calls the appropriate REST endpoint via `fetch()`
3. Flask route handler validates input and calls a helper function
4. Helper queries / writes to SQLite via SQLAlchemy
5. JSON response is returned to the frontend
6. `script.js` updates the DOM (tables, charts, KPI cards)

```
Browser (SPA)
     │
     │  fetch() REST API calls
     ▼
Flask Routes  ──►  Business Logic  ──►  SQLAlchemy  ──►  SQLite DB
                        │
                        ▼
                   AI Advisor
                 (Rule-based / Gemini)
```

---

## 5. Database Schema

### `income` table

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY | Auto-increment ID |
| `amount` | FLOAT | NOT NULL | Income in ₹ |
| `month` | VARCHAR(7) | NOT NULL | Format: `YYYY-MM` |
| `updated_at` | DATETIME | — | Last updated timestamp |

> One record per month. Setting income again for the same month **updates** the existing record.

### `expense` table

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PRIMARY KEY | Auto-increment ID |
| `amount` | FLOAT | NOT NULL | Expense amount in ₹ |
| `category` | VARCHAR(50) | NOT NULL | One of 9 valid categories |
| `description` | VARCHAR(200) | nullable | Optional note |
| `date` | DATE | NOT NULL | Expense date |
| `month` | VARCHAR(7) | NOT NULL | Derived from `date` as `YYYY-MM` |
| `created_at` | DATETIME | — | Record creation timestamp |

> Multiple expenses per month. The `month` field is auto-derived from `date` on insert.

---

## 6. API Reference

**Base URL (local):** `http://localhost:5000`  
**Content-Type:** `application/json`

---

### `GET /`
Returns the main SPA HTML page.

---

### `GET /api/income`
Get monthly income.

**Query Params:** `month` (default: current month, format `YYYY-MM`)

**Response:**
```json
{ "income": 25000.0, "month": "2026-09" }
```

---

### `POST /api/income`
Set or update monthly income.

**Body:**
```json
{ "amount": 25000, "month": "2026-09" }
```

**Validation:** `amount` required, must be ≥ 0

**Response (200):**
```json
{
  "success": true,
  "income": { "id": 1, "amount": 25000.0, "month": "2026-09", "updated_at": "..." }
}
```

---

### `GET /api/expenses`
Get list of expenses for a month.

**Query Params:** `month`, `category` (default: `All`)

**Response:**
```json
{
  "expenses": [
    { "id": 1, "amount": 7500.0, "category": "Rent", "description": "Monthly rent", "date": "2026-09-01", "month": "2026-09" }
  ]
}
```

---

### `POST /api/expenses`
Add a new expense.

**Body:**
```json
{ "amount": 500, "category": "Food", "description": "Lunch", "date": "2026-09-25" }
```

**Valid categories:** `Food` `Rent` `Transport` `Entertainment` `Shopping` `Education` `Healthcare` `Utilities` `Other`

**Validation:** `amount` > 0, valid category, date in `YYYY-MM-DD`

**Response (201):**
```json
{ "success": true, "expense": { "id": 5, "amount": 500.0, ... } }
```

---

### `DELETE /api/expenses/<id>`
Delete an expense by ID.

**Response (200):** `{ "success": true, "message": "Expense deleted" }`  
**Error (404):** `{ "error": "Expense not found" }`

---

### `GET /api/summary`
Get full financial summary for a month.

**Response:**
```json
{
  "month": "2026-09",
  "income": 28000.0,
  "total_expenses": 18000.0,
  "savings": 10000.0,
  "savings_pct": 35.7,
  "num_transactions": 5,
  "highest_category": "Rent",
  "highest_category_amount": 7500.0,
  "category_totals": {
    "Food": 3800.0, "Rent": 7500.0, "Transport": 2000.0,
    "Entertainment": 3500.0, "Shopping": 0.0, "Education": 0.0,
    "Healthcare": 0.0, "Utilities": 1200.0, "Other": 0.0
  }
}
```

**Formulas:**
- `savings` = `income` − `total_expenses`
- `savings_pct` = (`savings` / `income`) × 100

---

### `GET /api/budget`
Get budget analysis (recommended vs actual).

**Response:**
```json
{
  "income": 28000.0,
  "month": "2026-09",
  "budget": [
    { "category": "Rent", "recommended": 8400.0, "actual": 7500.0, "difference": 900.0, "overspent": false },
    { "category": "Entertainment", "recommended": 1400.0, "actual": 3500.0, "difference": -2100.0, "overspent": true },
    { "category": "Savings (Target)", "recommended": 5600.0, "actual": 10000.0, "difference": 4400.0, "overspent": false }
  ]
}
```

> `difference` = `recommended` − `actual`. Positive = under budget, Negative = over budget.

---

### `GET /api/ai-advice`
Get personalized financial advice.

**Response:**
```json
{
  "source": "rule-based",
  "note": "Set GEMINI_API_KEY in your .env file to enable AI-powered advice.",
  "advice": [
    "🌟 Excellent! You're saving 35.7% of your income (₹10,000/month). Keep it up!",
    "📊 You spent ₹3,500 on Entertainment, which is ₹2,100 above your limit of ₹1,400.",
    "🏦 Aim for an emergency fund of ₹168,000 (6 months of income)."
  ]
}
```

`source` is either `"rule-based"` or `"gemini-ai"`.

---

### `GET /api/categories`
**Response:** `{ "categories": ["Food", "Rent", "Transport", ...] }`

---

### `GET /api/months`
Get all months with data.

**Response:** `{ "months": ["2026-10", "2026-09", "2026-08"] }`

---

## 7. Budget Rules Engine

### Allocation Rules (% of Income)

| Category | % | Example (₹28,000) |
|---|---|---|
| Rent | 30% | ₹8,400 |
| Food | 15% | ₹4,200 |
| Transport | 10% | ₹2,800 |
| Utilities | 8% | ₹2,240 |
| Education | 7% | ₹1,960 |
| Shopping | 7% | ₹1,960 |
| Healthcare | 5% | ₹1,400 |
| Entertainment | 5% | ₹1,400 |
| Other | 5% | ₹1,400 |
| **Savings Target** | **20%** | **₹5,600** |

### Overspent Logic
```
difference = recommended - actual
overspent  = (difference < 0)
```

---

## 8. AI Advisor Module

### Mode 1: Rule-Based (Default — no API key needed)

| Rule | Condition | Tip |
|---|---|---|
| Savings check | `rate >= 30%` | Excellent savings message |
| Savings check | `20% ≤ rate < 30%` | Good savings message |
| Savings check | `0% ≤ rate < 20%` | Encourage saving more |
| Deficit alert | `rate < 0%` | Critical overspending alert |
| Category overspend | `actual > recommended × 1.25` | Overspending warning with amounts |
| Category underspend | `actual < recommended × 0.75` | Positive reinforcement |
| Savings boost | Low savings + high spend category | Suggest 20% cut |
| Emergency fund | Any positive savings | 6-month fund goal + months to reach |
| High rent | `rent > income × 35%` | Rent-to-income warning |

### Mode 2: Google Gemini AI

Set `GEMINI_API_KEY` in `.env`. The app sends actual financial data to **Gemini 1.5 Flash** with a structured prompt, and receives 5–7 personalized tips referencing real numbers.

### Fallback
If the API key is set but the call fails, the app **automatically falls back** to rule-based advice. The user always receives tips — no crashes.

---

## 9. Frontend Structure

### Sections & Functions

| Section | JS Function | Data Loaded From |
|---|---|---|
| Dashboard | `loadDashboard()` | `/api/summary` + `/api/expenses` |
| Expenses | `loadExpenses()` | `/api/expenses` + `/api/summary` |
| Budget Advisor | `loadBudget()` | `/api/budget` |
| AI Advisor | `loadAIAdvice()` | `/api/ai-advice` |
| Monthly Summary | `loadSummary()` | `/api/summary` + `/api/budget` |

### Charts

| Chart | Type | Source |
|---|---|---|
| Expense Breakdown | Doughnut | `category_totals` |
| Income vs Expenses | Bar | `income`, `total_expenses`, `savings` |

### Responsive Breakpoints

| Width | Behavior |
|---|---|
| > 900px | Two-column charts and summary grid |
| ≤ 900px | Single-column layout |
| ≤ 700px | Mobile: topbar + hamburger sidebar |
| ≤ 400px | Stacked KPI cards |

---

## 10. Environment Variables

```env
SECRET_KEY=your-random-secret-key
GEMINI_API_KEY=your-gemini-api-key-from-aistudio.google.com
FLASK_DEBUG=False
PORT=5000
```

| Variable | Required | Description |
|---|---|---|
| `SECRET_KEY` | Recommended | Flask session signing key |
| `GEMINI_API_KEY` | Optional | Enables Gemini AI advice |
| `FLASK_DEBUG` | Optional | `False` in production |
| `PORT` | Optional | Server port (default 5000) |

---

## 11. Installation & Setup

```bash
# Clone
git clone https://github.com/SheteArnav/personal-finance-advisor.git
cd personal-finance-advisor

# Virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

# Install
pip install -r requirements.txt

# Configure (optional)
cp .env.example .env

# Run
python app.py
# → http://localhost:5000
```

---

## 12. Deployment Guide (Render)

1. Sign up at [render.com](https://render.com)
2. **New → Web Service → Connect** `personal-finance-advisor` repo
3. Set:
   - Build: `pip install -r requirements.txt`
   - Start: `gunicorn app:app --bind 0.0.0.0:$PORT`
4. Add env vars: `SECRET_KEY`, `FLASK_DEBUG=False`
5. Click **Create Web Service**

Live URL ready in ~2 minutes.

> ⚠️ SQLite data resets on Render free-tier redeploy (ephemeral disk). Use Render paid plan + persistent disk for permanent data.

---

## 13. Testing

```bash
# Run the Flask app first, then in another terminal:
python -X utf8 test_api.py
```

**41 tests covering:** income CRUD, expense CRUD, input validation, dashboard summary calculations, budget logic, AI advice, month filtering, delete with 404.

```
RESULTS: 41 passed, 0 failed
🎉 ALL TESTS PASSED!
```

---

## 14. Troubleshooting

| Problem | Fix |
|---|---|
| App won't start | Activate venv, re-run `pip install -r requirements.txt` |
| Database error | Delete `instance/finance.db`, restart app |
| Port in use | Run `PORT=5001 python app.py` |
| Charts not showing | Check internet (Chart.js loads from CDN) |
| AI advice not working | No key = expected rule-based mode. Check key validity at aistudio.google.com |
| Data lost on Render | Expected on free tier — upgrade to paid plan for persistence |

---

*Documentation — Personal Finance Advisor Bot · SheteArnav · October 2026*
