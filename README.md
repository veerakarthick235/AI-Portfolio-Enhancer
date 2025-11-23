# AI Portfolio Enhancer

The **AI Portfolio Enhancer** is a web application that provides instant, actionable, and tailored feedback on portfolios (websites or GitHub repositories) using the AI. Users can specify their portfolio type and select the analysis model for highly customized reviews.

## ✨ Features

- **URL/Repo Analysis:** Submit a link to a web portfolio or GitHub repository for analysis.  
- **Tailored Feedback:** Select a Portfolio Type (e.g., Web Development, UX/UI Design) to guide the AI's review focus.  
- **Model Selection:** Choose between *Gemini 2.5 Flash* (fast) or *Gemini 2.5 Pro* (detailed).  
- **Structured Output:** Feedback includes:
  - Overall Impression & Fit for Role  
  - Technical Depth & Proof  
  - Presentation & User Experience (or Code Structure)  
  - Top 3 Actionable Next Steps  

## 🛠️ Project Structure

```
AI-Portfolio-Enhancer/
├── app.py                     # Flask Backend (Handles AI, API Calls)
├── requirements.txt           # Python dependencies
├── .env                       # Environment variables (Gemini API key)
├── .gitignore                 # Ignored files
└── static/
    ├── css/
    │   └── style.css          # Stylesheet
    └── js/
        └── script.js          # Frontend logic
└── templates/
    └── index.html             # Main UI
```

## 🚀 Getting Started

### Prerequisites
- Python 3.8+
- Gemini API Key (from Google AI Studio)

### Installation

**1. Clone the Repository**
```bash
git clone https://github.com/your-username/ai-portfolio-enhancer.git
cd ai-portfolio-enhancer
```

**2. Set up Environment**
```bash
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
```

**3. Install Dependencies**
```bash
pip install -r requirements.txt
```

**4. Configure API Key**

Create a `.env` file and add:

```
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
```

## ▶️ Running the Application

Start the Flask Server:

```bash
python app.py
```

Open your browser at:  
**http://127.0.0.1:5000/**

## ⚙️ Usage

1. Choose Portfolio Type  
2. Select the AI Model  
3. Enter Portfolio or GitHub URL  
4. Click **Analyze Portfolio**  
5. Review detailed structured feedback  

## 🤝 Contributing

1. Fork the repository  
2. Create a feature branch  
3. Commit changes  
4. Push and open a Pull Request  

## 📄 License

Licensed under the **MIT License**.

