import os
import json
import requests
import re
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from google import genai
from google.genai import types
from google.genai.errors import APIError
from dotenv import load_dotenv

# --- CONFIGURATION ---
load_dotenv()

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN', '')  # Optional: for higher GitHub API rate limits

app = Flask(__name__)
CORS(app)

# FIX 1: Flask-Limiter 3.x requires key_func as a keyword argument
limiter = Limiter(
    key_func=get_remote_address,
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
        print("✅ Gemini client initialized successfully.")
    except Exception as e:
        print(f"Error initializing Gemini client: {e}")


# ─────────────────────────────────────────────
#  HELPERS
# ─────────────────────────────────────────────

def is_valid_url(url: str) -> bool:
    """Basic URL validation."""
    return bool(re.match(r'^https?://', url, re.IGNORECASE))


def fetch_github_meta(url: str) -> dict | None:
    """Fetch real GitHub repo metadata via GitHub API."""
    try:
        parts = url.rstrip('/').split('/')
        if len(parts) < 5:
            return None
        owner, repo = parts[-2], parts[-1]

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
            'owner': owner,
            'repo': repo,
        }
    except Exception as e:
        print(f"GitHub API error: {e}")
        return None


def fetch_github_readme(owner: str, repo: str, branch: str = 'main') -> str:
    """
    FIX 3: Actually fetch the README content from GitHub so Gemini has real data.
    Falls back to 'master' if 'main' doesn't exist.
    """
    headers = {'Accept': 'application/vnd.github.v3+json'}
    if GITHUB_TOKEN:
        headers['Authorization'] = f'token {GITHUB_TOKEN}'

    for ref in [branch, 'main', 'master']:
        for filename in ['README.md', 'readme.md', 'README.rst', 'README.txt', 'README']:
            raw_url = f'https://raw.githubusercontent.com/{owner}/{repo}/{ref}/{filename}'
            try:
                resp = requests.get(raw_url, headers=headers, timeout=8)
                if resp.status_code == 200:
                    # Limit to 8000 chars to stay within prompt budget
                    return resp.text[:8000]
            except Exception:
                continue
    return "README not found or repository may be private."


def fetch_webpage_content(url: str) -> str:
    """
    FIX 4: Handle encoding errors gracefully when fetching webpage content.
    """
    try:
        resp = requests.get(url, timeout=10, headers={
            'User-Agent': 'Mozilla/5.0 (compatible; PortfolioReviewer/2.0)'
        })
        resp.raise_for_status()
        # FIX 4: Use apparent_encoding with fallback to avoid UnicodeDecodeError
        resp.encoding = resp.apparent_encoding or 'utf-8'
        content = resp.text[:15000]
        return f"Content extracted from URL: {url}\n\n--- Content Snippet (max 15,000 chars) ---\n\n{content}"
    except requests.exceptions.HTTPError as e:
        return f"Error: HTTP {e.response.status_code} when fetching URL. The page may require authentication or does not exist."
    except requests.exceptions.ConnectionError:
        return f"Error: Could not connect to {url}. Please check the URL is correct and publicly accessible."
    except requests.exceptions.Timeout:
        return f"Error: Request timed out for {url}. The server took too long to respond."
    except requests.exceptions.RequestException as e:
        return f"Error fetching content from URL: {e}"


def generate_structured_prompt(
    url: str,
    content: str,
    portfolio_type: str,
    is_github: bool,
    github_meta: dict | None = None,
) -> str:
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
- Repository Size (KB): {github_meta.get('size_kb', 0)}
"""

    # FIX 5: Pre-compute the conditional string to avoid f-string nesting issues
    # on Python < 3.12 where nested quotes inside f-strings are not allowed.
    presentation_title = "Repository Structure & Docs" if is_github else "Presentation & UX"
    github_focus = (
        "Since this is a GitHub repository, focus heavily on: README quality and "
        "completeness, project structure, code documentation quality (inferred), "
        "commit history activity, use of topics/tags, license, CI/CD indicators, "
        "and overall developer professionalism."
        if is_github else
        "Since this is a web portfolio, focus on: visual hierarchy, branding "
        "consistency, project showcasing effectiveness, skills presentation, "
        "contact information, responsiveness indicators, loading speed indicators, "
        "and SEO elements."
    )

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

{github_focus}

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
      "title": "{presentation_title}",
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


def clean_json_response(raw: str) -> str:
    """Strip markdown code fences that Gemini sometimes wraps around JSON."""
    cleaned = re.sub(r'^```(?:json)?\s*', '', raw.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r'\s*```$', '', cleaned)
    return cleaned.strip()


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
        'version': '2.1.0'
    })


@app.route('/github-meta', methods=['POST'])
@limiter.limit("30 per hour")
def github_meta_route():
    """Returns GitHub repository metadata."""
    data = request.get_json(silent=True) or {}
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

    data = request.get_json(silent=True) or {}
    portfolio_url  = data.get('url', '').strip()
    portfolio_type = data.get('type', 'General').strip()
    model_alias    = data.get('model', 'flash').strip()
    user_context   = data.get('context', '').strip()

    # FIX 2: validate URL before doing any network calls
    if not portfolio_url:
        return jsonify({'error': 'Please provide a portfolio URL.'}), 400
    if not is_valid_url(portfolio_url):
        return jsonify({'error': 'Invalid URL. URL must start with http:// or https://'}), 400

    selected_model = AVAILABLE_MODELS.get(model_alias, AVAILABLE_MODELS['flash'])
    is_github = 'github.com' in portfolio_url.lower()

    # --- Fetch metadata & content ---
    github_meta_data = None
    if is_github:
        github_meta_data = fetch_github_meta(portfolio_url)
        if github_meta_data:
            owner  = github_meta_data['owner']
            repo   = github_meta_data['repo']
            branch = github_meta_data.get('default_branch', 'main')
            # FIX 3: Pull the actual README so Gemini has real text to analyse
            readme_text = fetch_github_readme(owner, repo, branch)
            content = (
                f"GitHub Repository: {owner}/{repo}\n"
                f"URL: {portfolio_url}\n\n"
                f"--- README Content ---\n{readme_text}"
            )
        else:
            # Couldn't hit the API — fall back to URL-only hint
            parts = portfolio_url.rstrip('/').split('/')
            owner = parts[-2] if len(parts) >= 2 else 'unknown'
            repo  = parts[-1] if len(parts) >= 1 else 'unknown'
            content = (
                f"GitHub Repository: {owner}/{repo}\n"
                f"URL: {portfolio_url}\n"
                f"[Repository metadata could not be fetched. Analyse based on URL structure only.]"
            )
    else:
        content = fetch_webpage_content(portfolio_url)
        if content.startswith("Error"):
            return jsonify({'error': content}), 500

    if user_context:
        content += f"\n\nAdditional context from user: {user_context}"

    # --- Build prompt ---
    prompt = generate_structured_prompt(
        portfolio_url, content, portfolio_type, is_github, github_meta_data
    )

    # FIX 1 (Safety): 'OFF' is not a valid threshold value in google-genai.
    # The correct string is 'BLOCK_NONE'.
    safety_settings = [
        types.SafetySetting(category='HARM_CATEGORY_HARASSMENT',        threshold='BLOCK_NONE'),
        types.SafetySetting(category='HARM_CATEGORY_HATE_SPEECH',       threshold='BLOCK_NONE'),
        types.SafetySetting(category='HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold='BLOCK_NONE'),
        types.SafetySetting(category='HARM_CATEGORY_DANGEROUS_CONTENT', threshold='BLOCK_NONE'),
    ]

    generation_config = types.GenerateContentConfig(
        response_mime_type='application/json',
        temperature=0.4,
        safety_settings=safety_settings,
    )

    try:
        response = client.models.generate_content(
            model=selected_model,
            contents=[prompt],
            config=generation_config,
        )

        raw_text = response.text.strip()
        json_text = clean_json_response(raw_text)

        try:
            analysis_data = json.loads(json_text)
            return jsonify({
                'success': True,
                'structured': True,
                'analysis': analysis_data,
                'github_meta': github_meta_data,
                'model_used': selected_model,
            })
        except (json.JSONDecodeError, ValueError):
            # Fallback: return raw markdown text if JSON parsing fails
            return jsonify({
                'success': True,
                'structured': False,
                'analysis': raw_text,
                'github_meta': github_meta_data,
                'model_used': selected_model,
            })

    except APIError as e:
        return jsonify({
            'error': (
                f'Gemini API Error: Could not process the request. '
                f'(Status: {e.status_code}). '
                f'Please verify the API key and model usage.'
            )
        }), 500
    except Exception as e:
        return jsonify({'error': f'An unexpected error occurred during AI processing: {str(e)}'}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)
