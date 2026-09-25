# 💰 Personal Finance Advisor Bot

A full-stack personal finance web application built with **Python Flask** and **SQLite**. Track your income, expenses, savings, and get smart budget recommendations and AI-powered financial advice — all in a clean, responsive dashboard UI.

---

## 🚀 Live Demo

> Deploy to Render and add your URL here: `https://your-app.onrender.com`

---

## ✨ Features

| Feature | Description |
|---|---|
| **Dashboard** | Monthly KPIs: income, expenses, savings rate, transaction count + charts |
| **Expense Tracking** | Add / delete expenses with category, description, date |
| **Income Management** | Set and update monthly income |
| **Budget Advisor** | Recommended vs actual spending per category with progress bars |
| **AI Financial Advisor** | Smart rule-based advice (+ optional Google Gemini AI) |
| **Monthly Summary** | Full breakdown with insights and action recommendations |
| **Charts** | Donut (category breakdown) + Bar (income vs expenses) |
| **Responsive UI** | Works on desktop, tablet, and mobile |

---

## 🛠 Tech Stack

- **Backend**: Python 3.11+, Flask 3.0, SQLAlchemy
- **Database**: SQLite (auto-created on first run)
- **Frontend**: HTML5, CSS3, Vanilla JavaScript, Chart.js
- **AI**: Google Gemini 1.5 Flash (optional) + rule-based fallback
- **Deployment**: Gunicorn + Render

---

## 📂 Project Structure

```
personal-finance-advisor/
│
├── app.py                  # Flask app, API routes, models, advisor logic
├── requirements.txt        # Python dependencies
├── Procfile                # Deployment: Gunicorn command
├── .env.example            # Environment variables template
├── .gitignore
├── README.md
│
├── templates/
│   └── index.html          # Single-page application template
│
├── static/
│   ├── style.css           # Complete responsive stylesheet
│   └── script.js           # All client-side logic + Chart.js
│
└── instance/
    └── finance.db          # SQLite database (auto-created)
```

---

## ⚡ Quick Start (Local)

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/personal-finance-advisor.git
cd personal-finance-advisor
```

### 2. Create a virtual environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Set up environment variables
```bash
cp .env.example .env
# Edit .env if needed (see Environment Variables section below)
```

### 5. Run the application
```bash
python app.py
```

Open your browser at: **http://localhost:5000**

---

## 🔑 Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

| Variable | Required | Description |
|---|---|---|
| `SECRET_KEY` | Recommended | Flask session secret key |
| `GEMINI_API_KEY` | Optional | Google Gemini API key for AI advice |
| `FLASK_DEBUG` | Optional | `True` for development, `False` for production |
| `PORT` | Optional | Server port (default: 5000) |

### Getting a Gemini API Key (Free)
1. Go to [aistudio.google.com](https://aistudio.google.com/)
2. Sign in with your Google account
3. Click **Get API Key**
4. Add it to your `.env` file as `GEMINI_API_KEY=your_key_here`

> **Without an API key**, the app uses smart rule-based advice — it still works great!

---

## 🌐 Deploy to Render (Free)

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit: Personal Finance Advisor"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/personal-finance-advisor.git
git push -u origin main
```

### Step 2: Create Render Account
1. Go to [render.com](https://render.com/) and sign up (free)
2. Click **New → Web Service**

### Step 3: Connect your GitHub repo
1. Select your `personal-finance-advisor` repository
2. Render auto-detects the `Procfile`

### Step 4: Configure the service
| Setting | Value |
|---|---|
| **Name** | `personal-finance-advisor` |
| **Environment** | `Python 3` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `gunicorn app:app --bind 0.0.0.0:$PORT` |

### Step 5: Add Environment Variables
In Render → Environment section, add:
- `SECRET_KEY` = (generate a random key)
- `GEMINI_API_KEY` = (your key, optional)
- `FLASK_DEBUG` = `False`

### Step 6: Deploy
Click **Create Web Service**. Your live URL will be shown (e.g., `https://personal-finance-advisor.onrender.com`).

> **Note**: On Render's free tier, the SQLite database resets on each deployment. For persistent data, upgrade to a paid plan or use PostgreSQL.

---

## 📖 How to Use

### 1. Set Your Income
- Click **"Set Income"** on the Dashboard
- Enter your monthly income in ₹
- Select the month and save

### 2. Add Expenses
- Go to **Expenses** section
- Click **"+ Add Expense"**
- Fill in amount, category, date, and description

### 3. View Budget Analysis
- Go to **Budget Advisor**
- See recommended vs actual spending per category
- Green bars = within budget, Red bars = over budget

### 4. Get Financial Advice
- Go to **AI Financial Advisor**
- Click **"Refresh Advice"** to get personalized tips
- Tips are generated based on your actual income and spending data

### 5. View Monthly Summary
- Go to **Monthly Summary**
- See complete financial health report with insights and recommendations

---

## 📊 Budget Rules Used

The budget advisor uses these widely-accepted guidelines (as % of income):

| Category | Recommended |
|---|---|
| Rent | 30% |
| Food | 15% |
| Transport | 10% |
| Utilities | 8% |
| Education | 7% |
| Shopping | 7% |
| Healthcare | 5% |
| Entertainment | 5% |
| Other | 5% |
| **Savings Target** | **20%** |

---

## 🤖 AI Advisor Details

The AI advisor works in two modes:

1. **Rule-based** (default, no API key needed):
   - Analyzes your spending against budget rules
   - Highlights overspending categories
   - Suggests ways to increase savings
   - Provides emergency fund guidance

2. **Google Gemini AI** (requires `GEMINI_API_KEY`):
   - Sends your financial data to Gemini 1.5 Flash
   - Returns personalized, context-aware advice
   - API key is never exposed to the frontend

---

## 📝 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/summary?month=YYYY-MM` | Dashboard summary |
| GET/POST | `/api/income?month=YYYY-MM` | Get/set income |
| GET/POST | `/api/expenses` | List/add expenses |
| DELETE | `/api/expenses/<id>` | Delete expense |
| GET | `/api/budget?month=YYYY-MM` | Budget analysis |
| GET | `/api/ai-advice?month=YYYY-MM` | AI/rule advice |
| GET | `/api/categories` | List of categories |
| GET | `/api/months` | Months with data |

---

## 📋 Sample Data to Test

1. Set income: ₹25,000
2. Add expenses:
   - Rent: ₹7,500
   - Food: ₹3,800
   - Transport: ₹2,000
   - Entertainment: ₹3,500 (over budget!)
   - Utilities: ₹1,200
3. View Budget Advisor → Entertainment will show overspending
4. View AI Advisor → Get specific tips on your spending

---

## 📄 License

MIT License — Free to use for educational and personal projects.
