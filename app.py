import os
import json
import requests
import re
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from google import genai
from google.genai.errors import APIError
from dotenv import load_dotenv

# --- CONFIGURATION ---
load_dotenv()

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN', '')  # Optional: for higher GitHub API rate limits

app = Flask(__name__)
CORS(app)

# Rate Limiting: 15 analyze requests per hour per IP
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

# Model definitions
AVAILABLE_MODELS = {
    'flash': 'gemini-2.5-flash',
    'pro': 'gemini-2.5-pro'
}

client = None
if not GEMINI_API_KEY:
    print("🚨 FATAL ERROR: GEMINI_API_KEY not found in .env file or environment variables.")
else:
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        print(f"Error initializing Gemini client: {e}")


# ─────────────────────────────────────────────
#  HELPERS
# ─────────────────────────────────────────────

def fetch_github_meta(url):
    """Fetch real GitHub repo metadata via GitHub API."""
    try:
        # Extract owner/repo from URL
        parts = url.rstrip('/').split('/')
        if len(parts) < 5:
            return None
        owner = parts[-2]
        repo = parts[-1]

        headers = {'Accept': 'application/vnd.github.v3+json'}
        if GITHUB_TOKEN:
            headers['Authorization'] = f'token {GITHUB_TOKEN}'

        api_url = f'https://api.github.com/repos/{owner}/{repo}'
        resp = requests.get(api_url, headers=headers, timeout=8)
        if resp.status_code != 200:
            return None

        data = resp.json()

        # Fetch languages
        lang_resp = requests.get(data.get('languages_url', ''), headers=headers, timeout=5)
        languages = lang_resp.json() if lang_resp.status_code == 200 else {}

        return {
            'name': data.get('name', repo),
            'full_name': data.get('full_name', f'{owner}/{repo}'),
            'description': data.get('description', ''),
            'stars': data.get('stargazers_count', 0),
            'forks': data.get('forks_count', 0),
            'watchers': data.get('watchers_count', 0),
            'open_issues': data.get('open_issues_count', 0),
            'language': data.get('language', 'N/A'),
            'languages': languages,
            'last_push': data.get('pushed_at', ''),
            'created_at': data.get('created_at', ''),
            'license': data.get('license', {}).get('name', 'None') if data.get('license') else 'None',
            'topics': data.get('topics', []),
            'default_branch': data.get('default_branch', 'main'),
            'html_url': data.get('html_url', url),
            'homepage': data.get('homepage', ''),
            'size_kb': data.get('size', 0),
            'has_wiki': data.get('has_wiki', False),
            'has_pages': data.get('has_pages', False),
        }
    except Exception as e:
        print(f"GitHub API error: {e}")
        return None


def fetch_webpage_content(url):
    """Fetches and returns a content snippet from a standard webpage."""
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        content = response.text[:15000]
        return f"Content extracted from URL: {url}\n\n--- Content Snippet (max 15,000 chars) ---\n\n{content}"
    except requests.exceptions.RequestException as e:
        return f"Error fetching content from URL. Please ensure the link is direct and publicly accessible. Error: {e}"


def generate_structured_prompt(url, content, portfolio_type, is_github, github_meta=None):
    """
    Generates a prompt that instructs Gemini to return a structured JSON object
    with scores and detailed sections.
    """
    github_context = ""
    if is_github and github_meta:
        github_context = f"""
GitHub Repository Statistics (Real Data):
- Stars: {github_meta.get('stars', 0)}
- Forks: {github_meta.get('forks', 0)}
- Primary Language: {github_meta.get('language', 'N/A')}
- All Languages: {json.dumps(github_meta.get('languages', {}))}
- Last Push: {github_meta.get('last_push', 'Unknown')}
- License: {github_meta.get('license', 'None')}
- Topics: {', '.join(github_meta.get('topics', []))}
- Has GitHub Pages: {github_meta.get('has_pages', False)}
- Description: {github_meta.get('description', 'Not provided')}
"""

    prompt = f"""
You are an expert AI Portfolio Reviewer specializing in **{portfolio_type}** roles.
Analyze the following portfolio content and provide a COMPREHENSIVE, DETAILED review.

URL: {url}
Portfolio Type: {portfolio_type}
Is GitHub Repository: {is_github}
{github_context}

Content:
---
{content}
---

{"Since this is a GitHub repository, focus heavily on: README quality and completeness, project structure, code documentation quality (inferred), commit history activity, use of topics/tags, license, CI/CD indicators, and overall developer professionalism." if is_github else "Since this is a web portfolio, focus on: visual hierarchy, branding consistency, project showcasing effectiveness, skills presentation, contact information, responsiveness indicators, loading speed indicators, and SEO elements."}

Return your response as a VALID JSON object with EXACTLY this structure (no markdown code blocks, pure JSON):

{{
  "scores": {{
    "overall": <integer 0-100>,
    "technical": <integer 0-100>,
    "presentation": <integer 0-100>,
    "branding": <integer 0-100>
  }},
  "summary": "<2-3 sentence executive summary of the portfolio>",
  "quick_wins": [
    "<specific actionable quick win 1>",
    "<specific actionable quick win 2>",
    "<specific actionable quick win 3>"
  ],
  "sections": {{
    "overall_impression": {{
      "title": "Overall Impression & Role Fit",
      "rating": "<Excellent | Strong | Good | Needs Work | Poor>",
      "content": "<detailed 3-5 paragraph markdown analysis>",
      "highlights": ["<positive point 1>", "<positive point 2>"],
      "improvements": ["<improvement 1>", "<improvement 2>"]
    }},
    "technical_depth": {{
      "title": "Technical Depth & Proof",
      "rating": "<Excellent | Strong | Good | Needs Work | Poor>",
      "content": "<detailed 3-5 paragraph markdown analysis>",
      "highlights": ["<positive point 1>", "<positive point 2>"],
      "improvements": ["<improvement 1>", "<improvement 2>"]
    }},
    "presentation": {{
      "title": "{('Repository Structure & Docs' if is_github else 'Presentation & UX')}",
      "rating": "<Excellent | Strong | Good | Needs Work | Poor>",
      "content": "<detailed 3-5 paragraph markdown analysis>",
      "highlights": ["<positive point 1>", "<positive point 2>"],
      "improvements": ["<improvement 1>", "<improvement 2>"]
    }},
    "action_plan": {{
      "title": "Top Actionable Next Steps",
      "content": "<brief intro paragraph>",
      "steps": [
        {{"priority": "High", "action": "<specific action>", "impact": "<expected impact>", "effort": "<Low | Medium | High>"}},
        {{"priority": "High", "action": "<specific action>", "impact": "<expected impact>", "effort": "<Low | Medium | High>"}},
        {{"priority": "Medium", "action": "<specific action>", "impact": "<expected impact>", "effort": "<Low | Medium | High>"}},
        {{"priority": "Medium", "action": "<specific action>", "impact": "<expected impact>", "effort": "<Low | Medium | High>"}},
        {{"priority": "Low", "action": "<specific action>", "impact": "<expected impact>", "effort": "<Low | Medium | High>"}}
      ]
    }}
  }}
}}

Be specific, honest, and constructive. Use real insights based on the actual content provided. Do not be generic.
"""
    return prompt


# ─────────────────────────────────────────────
#  ROUTES
# ─────────────────────────────────────────────

@app.route('/')
def index():
    """Serves the main HTML page."""
    return render_template('index.html')


@app.route('/health')
def health():
    """Health check endpoint."""
    return jsonify({
        'status': 'ok',
        'ai_service': 'available' if client else 'unavailable',
        'version': '2.0.0'
    })


@app.route('/github-meta', methods=['POST'])
@limiter.limit("30 per hour")
def github_meta():
    """Returns GitHub repository metadata."""
    data = request.get_json()
    url = data.get('url', '').strip()

    if not url or 'github.com' not in url.lower():
        return jsonify({'error': 'Please provide a valid GitHub URL.'}), 400

    meta = fetch_github_meta(url)
    if not meta:
        return jsonify({'error': 'Could not fetch repository data. The repo may be private or the URL is invalid.'}), 404

    return jsonify(meta)


@app.route('/analyze', methods=['POST'])
@limiter.limit("15 per hour")
def analyze_portfolio():
    """Endpoint to trigger the AI analysis."""
    if not client:
        return jsonify({'error': 'AI service is unavailable. Check GEMINI_API_KEY configuration.'}), 503

    data = request.get_json()
    portfolio_url = data.get('url', '').strip()
    portfolio_type = data.get('type', 'General').strip()
    model_alias = data.get('model', 'flash').strip()
    user_context = data.get('context', '').strip()

    selected_model = AVAILABLE_MODELS.get(model_alias, AVAILABLE_MODELS['flash'])

    if not portfolio_url:
        return jsonify({'error': 'Please provide a valid portfolio URL.'}), 400

    is_github = "github.com" in portfolio_url.lower()

    # Fetch GitHub metadata if applicable
    github_meta_data = None
    if is_github:
        github_meta_data = fetch_github_meta(portfolio_url)

    # Fetch content
    if is_github:
        repo_name = portfolio_url.rstrip('/').split('/')[-1]
        user_name = portfolio_url.rstrip('/').split('/')[-2]
        content = (
            f"GitHub Repository: {user_name}/{repo_name}\n"
            f"URL: {portfolio_url}\n"
            f"[The AI should analyze this based on the GitHub metadata and URL structure provided. "
            f"Focus on what can be inferred from the repository statistics and common best practices.]"
        )
        if user_context:
            content += f"\n\nAdditional context from user: {user_context}"
    else:
        content = fetch_webpage_content(portfolio_url)
        if content.startswith("Error fetching content"):
            return jsonify({'error': content}), 500
        if user_context:
            content += f"\n\nAdditional context from user: {user_context}"

    # Build prompt
    prompt = generate_structured_prompt(portfolio_url, content, portfolio_type, is_github, github_meta_data)

    try:
        response = client.models.generate_content(
            model=selected_model,
            contents=[prompt]
        )

        raw_text = response.text.strip()

        # Try to parse as JSON
        try:
            # Remove potential markdown code fences
            json_text = re.sub(r'^```(?:json)?\n?', '', raw_text, flags=re.MULTILINE)
            json_text = re.sub(r'\n?```$', '', json_text, flags=re.MULTILINE)
            analysis_data = json.loads(json_text.strip())
            return jsonify({
                'success': True,
                'structured': True,
                'analysis': analysis_data,
                'github_meta': github_meta_data,
                'model_used': selected_model
            })
        except (json.JSONDecodeError, ValueError):
            # Fallback: return raw markdown text
            return jsonify({
                'success': True,
                'structured': False,
                'analysis': raw_text,
                'github_meta': github_meta_data,
                'model_used': selected_model
            })

    except APIError as e:
        return jsonify({'error': f'Gemini API Error: Could not process the request. (Status: {e.status_code}). Please verify the API key and model usage.'}), 500
    except Exception as e:
        return jsonify({'error': f'An unexpected error occurred during AI processing: {str(e)}'}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)
