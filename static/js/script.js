/**
 * AI Portfolio Enhancer - Enhanced Script
 * Converts Markdown to HTML with improved formatting
 */

/**
 * Advanced Markdown to HTML converter
 * @param {string} markdownText - The markdown string from the Gemini API
 * @returns {string} The formatted HTML string
 */
function simpleMarkdownToHtml(markdownText) {
    let html = markdownText;
    
    // Replace headings
    html = html.replace(/^###\s*(.*)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s*(.*)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s*(.*)$/gm, '<h1>$1</h1>');
    
    // Replace bold (**text** or __text__)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
    
    // Replace italic (*text* or _text_)
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.*?)_/g, '<em>$1</em>');
    
    // Process lists
    let listHtml = [];
    let lines = html.split('\n');
    let inList = false;

    lines.forEach(line => {
        if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
            if (!inList) {
                listHtml.push('<ul>');
                inList = true;
            }
            listHtml.push(`<li>${line.substring(2).trim()}</li>`);
        } else {
            if (inList) {
                listHtml.push('</ul>');
                inList = false;
            }
            listHtml.push(line);
        }
    });
    
    if (inList) {
        listHtml.push('</ul>');
    }
    
    html = listHtml.join('\n');

    // Convert newlines to paragraphs
    html = html.replace(/\n\s*\n/g, '</p><p>');
    html = '<p>' + html + '</p>';
    
    // Clean up empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '');
    html = html.replace(/<p>\s*<h/g, '<h');
    html = html.replace(/<\/h(\d)>\s*<\/p>/g, '</h$1>');
    html = html.replace(/<p>\s*<ul>/g, '<ul>');
    html = html.replace(/<\/ul>\s*<\/p>/g, '</ul>');

    return html;
}

/**
 * Analyzes the portfolio by sending data to the backend
 */
async function analyzePortfolio() {
    const urlInput = document.getElementById('portfolio-url');
    const typeInput = document.getElementById('portfolio-type');
    const modelInput = document.getElementById('ai-model');

    const url = urlInput.value.trim();
    const type = typeInput.value;
    const model = modelInput.value;
    
    const loader = document.getElementById('loader');
    const resultsContainer = document.getElementById('results-container');
    const analysisOutput = document.getElementById('analysis-output');
    const errorMsg = document.getElementById('error-message');
    const errorText = errorMsg.querySelector('.error-text');

    // Reset UI
    resultsContainer.classList.add('hidden');
    analysisOutput.innerHTML = '';
    errorMsg.classList.add('hidden');

    // Validation
    if (!url) {
        showError('Please enter a valid URL.');
        return;
    }

    if (!isValidUrl(url)) {
        showError('Please enter a properly formatted URL (e.g., https://example.com)');
        return;
    }

    // Show loader
    loader.classList.remove('hidden');

    try {
        const response = await fetch('/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                url: url,
                type: type, 
                model: model 
            }),
        });

        const data = await response.json();
        loader.classList.add('hidden');
        
        if (data.error) {
            showError(data.error);
            return;
        }

        // Convert Markdown to HTML
        const htmlContent = simpleMarkdownToHtml(data.analysis);
        
        // Display results with animation
        analysisOutput.innerHTML = htmlContent;
        resultsContainer.classList.remove('hidden');
        
        // Smooth scroll to results
        resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
    } catch (error) {
        console.error('Fetch error:', error);
        loader.classList.add('hidden');
        showError('A network error occurred. Please check your connection and try again.');
    }
}

/**
 * Display error message
 * @param {string} message - Error message to display
 */
function showError(message) {
    const errorMsg = document.getElementById('error-message');
    const errorText = errorMsg.querySelector('.error-text');
    errorText.textContent = message;
    errorMsg.classList.remove('hidden');
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} Whether URL is valid
 */
function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

// Allow Enter key to submit
document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('portfolio-url');
    
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            analyzePortfolio();
        }
    });
});