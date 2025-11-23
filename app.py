import os
import requests
import re
from flask import Flask, render_template, request, jsonify
from google import genai
from google.genai.errors import APIError
from dotenv import load_dotenv

# --- CONFIGURATION ---
load_dotenv() 

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY') 
app = Flask(__name__)

# Model definitions (can be expanded)
AVAILABLE_MODELS = {
    'flash': 'gemini-2.5-flash',
    'pro': 'gemini-2.5-pro'
}

client = None
if not GEMINI_API_KEY:
    print("🚨 FATAL ERROR: GEMINI_API_KEY not found in .env file or environment variables.")
else:
    try:
        # Initialize client using the fastest model by default
        client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        print(f"Error initializing Gemini client: {e}")


def fetch_content(url):
    """
    Fetches content from a URL or simulates fetching repo details for a GitHub link.
    """
    if "github.com" in url.lower():
        # Simple simulation: In a real-world app, you'd use the GitHub API here
        repo_name = url.split('/')[-1]
        user_name = url.split('/')[-2]
        
        # This is a placeholder for actual GitHub API content retrieval.
        # It's expensive and complex to clone/analyze code files in a simple Flask app.
        # We instruct the model based on the URL structure.
        return f"GitHub Repository Detected:\nUser: {user_name}\nRepo: {repo_name}\n\n[SIMULATED CONTENT]: AI is asked to focus on repo structure, README quality, code samples (if accessible), and commit history demonstrated by the link."
    
    try:
        # Standard webpage fetching (HTML)
        response = requests.get(url, timeout=10)
        response.raise_for_status() 
        
        # Take the first 15,000 characters of the raw content for analysis
        content = response.text[:15000] 
        return f"Content extracted from URL: {url}\n\n--- Content Snippet (max 15,000 chars) ---\n\n{content}"
    except requests.exceptions.RequestException as e:
        return f"Error fetching content from URL. Please ensure the link is direct and publicly accessible. Error: {e}"

def generate_prompt(url, content, portfolio_type, is_github):
    """
    Generates a tailored prompt based on the user's input selections.
    """
    # Base instructions
    prompt = f"""
    You are an expert AI Portfolio Reviewer specializing in **{portfolio_type}** portfolios. 
    Analyze the content extracted from the URL: {url}.
    """

    # Add content snippet
    prompt += f"""
    The content snippet is provided below:
    ---
    {content}
    ---
    
    """
    
    # Adjust instructions for GitHub links
    if is_github:
        prompt += """
        Given this is a **GitHub repository**, prioritize your analysis on:
        1. **README Quality:** Is the project's purpose, installation, and usage clear?
        2. **Repository Structure:** Are files logically organized? Is the dependency file clear?
        3. **Code Style & Documentation:** (Infer from the structure) Is the assumed code professional and well-commented?
        """
    else:
        # Standard Website/Document review
        prompt += """
        Given this is a standard **Web Portfolio**, prioritize your analysis on:
        1. **Visual Hierarchy & Navigation:** Is it easy to find key information (skills, contact, projects)?
        2. **Responsiveness:** Is the design likely to work well on different screen sizes?
        3. **Personal Branding:** Does the voice and design align with the user's stated career goals?
        """

    # Final detailed structure for feedback
    prompt += """
    Provide constructive feedback in four key sections using clear Markdown formatting (H3 headers, **bold**, and bullet points):
    
    ### 1. Overall Impression & Fit for Role
    Assess the immediate impact and how well the portfolio aligns with a **{portfolio_type}** role.
    
    ### 2. Technical Depth & Proof
    Comment on how effectively projects showcase technical skills, methodologies, and problem-solving abilities relevant to **{portfolio_type}**.
    
    ### 3. Presentation & User Experience (or Code Structure for GitHub)
    Review the visual design (if website) OR the repository structure/README quality (if GitHub).
    
    ### 4. Top 3 Actionable Next Steps
    Provide 3 specific, high-impact steps the user can take *today* to enhance this portfolio.
    """
    return prompt

@app.route('/')
def index():
    """Serves the main HTML page."""
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
def analyze_portfolio():
    """Endpoint to trigger the AI analysis."""
    if not client:
        return jsonify({'error': 'AI service is unavailable. Check GEMINI_API_KEY configuration.'}), 503

    data = request.get_json()
    portfolio_url = data.get('url', '').strip()
    portfolio_type = data.get('type', 'General').strip()
    model_alias = data.get('model', 'flash').strip()
    
    selected_model = AVAILABLE_MODELS.get(model_alias, AVAILABLE_MODELS['flash'])

    if not portfolio_url:
        return jsonify({'error': 'Please provide a valid portfolio URL.'}), 400

    # 1. Fetch content
    is_github = "github.com" in portfolio_url.lower()
    content = fetch_content(portfolio_url)

    if content.startswith("Error fetching content"):
        return jsonify({'error': content}), 500

    # 2. Construct the prompt
    prompt = generate_prompt(portfolio_url, content, portfolio_type, is_github)

    try:
        # 3. Call the Gemini API
        response = client.models.generate_content(
            model=selected_model,
            contents=[prompt]
        )
        
        # 4. Return the result
        return jsonify({'analysis': response.text, 'model_used': selected_model})

    except APIError as e:
        return jsonify({'error': f'Gemini API Error: Could not process the request. (Status: {e.status_code}). Please verify the API key and model usage.'}), 500
    except Exception as e:
        return jsonify({'error': f'An unexpected error occurred during AI processing: {e}'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)