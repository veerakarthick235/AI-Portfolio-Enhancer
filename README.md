# PortfolioAI — AI-Powered Portfolio Intelligence

<div align="center">

![PortfolioAI Banner](static/ai.png)

**Get instant, expert-level AI feedback on your developer portfolio or GitHub repository.**  
No signup. No credit card. Just results.

[![Python](https://img.shields.io/badge/Python-3.8+-3776AB?style=flat&logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-2.x-000000?style=flat&logo=flask&logoColor=white)](https://flask.palletsprojects.com)
[![Gemini](https://img.shields.io/badge/Powered%20by-Google%20Gemini%202.5-4285F4?style=flat&logo=google&logoColor=white)](https://ai.google.dev)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat)](LICENSE)

</div>

---

## ✨ Features

### 🆓 Free Tier (No Login Required)

| Feature | Description |
|---|---|
| 🤖 **Gemini-Powered Analysis** | Google Gemini 2.5 Flash & Pro models |
| 🧭 **3-Step Guided Wizard** | Role → URL → Launch — clean and intuitive |
| 📊 **Multi-Dimensional Scores** | Animated radial gauges for Overall, Technical, Presentation & Branding |
| ⚡ **Instant Quick Wins** | Top 3 highest-impact improvements you can make today |
| 🐙 **GitHub Intelligence** | Live repo stats — stars, forks, language, topics, license |
| 🗂️ **Tabbed Report** | Overview · Technical · Presentation · Action Plan |
| 🕓 **Analysis History** | Last 5 analyses saved locally — re-load without re-running AI |
| 📋 **Copy to Clipboard** | Copy any report section with one click |
| 📄 **PDF Export** | Print a formatted PDF of your full report |

### 🔒 Pro (Coming Soon)

- 👥 Team Analysis — compare multiple portfolios
- 🎛️ Custom Rubric — upload your own evaluation criteria
- 📦 Bulk Analysis — batch process multiple URLs

---

## 🛠️ Project Structure

```
AI-Portfolio-Enhancer/
├── app.py                     # Flask backend — AI, GitHub API, rate limiting
├── requirements.txt           # Python dependencies
├── .env                       # Environment variables (API keys)
├── .gitignore
├── static/
│   ├── ai.png                 # App icon / logo
│   ├── css/
│   │   └── style.css          # Premium SaaS design system
│   └── js/
│       └── script.js          # Wizard, gauges, history, particle canvas
└── templates/
    └── index.html             # Full SaaS UI (hero → wizard → results)
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.8+
- [Google Gemini API Key](https://aistudio.google.com/app/apikey) (free)
- *(Optional)* [GitHub Personal Access Token](https://github.com/settings/tokens) — raises GitHub API rate limits from 60 → 5,000 req/hour

### Installation

**1. Clone the repository**
```bash
git clone https://github.com/veerakarthick235/AI-Portfolio-Enhancer.git
cd AI-Portfolio-Enhancer
```

**2. Create and activate a virtual environment**
```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

**3. Install dependencies**
```bash
pip install -r requirements.txt
```

**4. Configure environment variables**

Create a `.env` file in the project root:

```env
# Required
GEMINI_API_KEY="your_gemini_api_key_here"

# Optional — for higher GitHub API rate limits (5000/hr vs 60/hr)
GITHUB_TOKEN="your_github_token_here"
```

---

## ▶️ Running the Application

```bash
python app.py
```

Open your browser at **http://127.0.0.1:5000/**

---

## ⚙️ API Endpoints

| Method | Endpoint | Description | Rate Limit |
|---|---|---|---|
| `GET` | `/` | Main application UI | — |
| `GET` | `/health` | Service health check | — |
| `POST` | `/analyze` | Run AI portfolio analysis | 15 / hour / IP |
| `POST` | `/github-meta` | Fetch GitHub repository stats | 30 / hour / IP |

### `/analyze` — Request body
```json
{
  "url": "https://github.com/user/repo",
  "type": "AI Engineer",
  "model": "flash",
  "context": "Optional extra context for the AI"
}
```

### `/analyze` — Response (structured)
```json
{
  "success": true,
  "structured": true,
  "model_used": "gemini-2.5-flash",
  "github_meta": { "stars": 42, "forks": 8, "language": "Python", "..." : "..." },
  "analysis": {
    "scores": { "overall": 78, "technical": 82, "presentation": 74, "branding": 71 },
    "summary": "Strong technical foundation with clear project demos...",
    "quick_wins": ["Add a live demo link", "..."],
    "sections": {
      "overall_impression": { "rating": "Strong", "content": "...", "highlights": [], "improvements": [] },
      "technical_depth":    { "rating": "Excellent", "..." : "..." },
      "presentation":       { "rating": "Good", "..." : "..." },
      "action_plan":        { "steps": [{ "priority": "High", "action": "...", "impact": "...", "effort": "Low" }] }
    }
  }
}
```

---

## 🖥️ Usage Walkthrough

1. **Choose your target role** — AI Engineer, Data Science/ML, Full Stack, Frontend, Backend, or General
2. **Paste your URL** — Portfolio website or GitHub repository link
   - GitHub repos show a live preview card (stars, forks, language, topics)
3. **Add optional context** — e.g., *"Applying for senior ML roles at startups"*
4. **Select AI model** — Gemini 2.5 Flash (fast, ~8s) or Gemini 2.5 Pro (deep, ~25s)
5. **Launch Analysis** — Animated score gauges and a full 4-tab report appear
6. **Export or Save** — Copy sections, export PDF, or revisit from the history panel

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python · Flask · Flask-Limiter · Flask-CORS |
| **AI** | Google Gemini 2.5 Flash & Pro (`google-genai`) |
| **External APIs** | GitHub REST API v3 |
| **Frontend** | Vanilla HTML · CSS · JavaScript (no framework) |
| **Fonts** | Outfit · Inter (Google Fonts) |
| **Icons** | Font Awesome 6 |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push and open a Pull Request

---

## 📄 License

Licensed under the **MIT License**. See [LICENSE](LICENSE) for details.
