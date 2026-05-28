/**
 * PortfolioAI — Premium SaaS Frontend
 * Handles: wizard, particle canvas, GitHub meta, AI analysis,
 *          SVG gauges, tabbed results, localStorage history, PDF export
 */

'use strict';

// ─────────────────────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────────────────────
const state = {
    currentStep: 1,
    selectedRole: 'AI Engineer',
    selectedModel: 'flash',
    portfolioUrl: '',
    githubDebounceTimer: null,
    isAnalyzing: false,
    lastResult: null,
};

// ─────────────────────────────────────────────────────────────
//  PARTICLE CANVAS
// ─────────────────────────────────────────────────────────────
function initParticles() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;

    const PARTICLE_COUNT = Math.min(80, Math.floor(W * H / 12000));
    const particles = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
            x: Math.random() * W,
            y: Math.random() * H,
            r: Math.random() * 1.5 + 0.5,
            dx: (Math.random() - 0.5) * 0.3,
            dy: (Math.random() - 0.5) * 0.3,
            opacity: Math.random() * 0.4 + 0.1,
        });
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);

        // Draw connections
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dist = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y);
                if (dist < 120) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(124, 58, 237, ${0.06 * (1 - dist / 120)})`;
                    ctx.lineWidth = 0.5;
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }

        // Draw particles
        particles.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(139, 92, 246, ${p.opacity})`;
            ctx.fill();

            p.x += p.dx;
            p.y += p.dy;

            if (p.x < 0 || p.x > W) p.dx *= -1;
            if (p.y < 0 || p.y > H) p.dy *= -1;
        });

        requestAnimationFrame(draw);
    }

    draw();

    window.addEventListener('resize', () => {
        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
    });
}

// ─────────────────────────────────────────────────────────────
//  NAVBAR SCROLL EFFECT
// ─────────────────────────────────────────────────────────────
function initNavbar() {
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });
}

// ─────────────────────────────────────────────────────────────
//  COUNTER ANIMATION (hero stats)
// ─────────────────────────────────────────────────────────────
function animateCounters() {
    const els = document.querySelectorAll('[data-target]');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            const target = parseInt(el.dataset.target, 10);
            const duration = 1800;
            const step = target / (duration / 16);
            let current = 0;
            const timer = setInterval(() => {
                current = Math.min(current + step, target);
                el.textContent = Math.floor(current).toLocaleString();
                if (current >= target) clearInterval(timer);
            }, 16);
            observer.unobserve(el);
        });
    }, { threshold: 0.5 });

    els.forEach(el => observer.observe(el));
}

// ─────────────────────────────────────────────────────────────
//  TYPING EFFECT (hero title)
// ─────────────────────────────────────────────────────────────
function initTypingEffect() {
    const el = document.getElementById('typing-target');
    if (!el) return;
    const phrases = ['Perfected by AI', 'Reviewed Instantly', 'Ready to Impress', 'Supercharged with AI'];
    let phraseIdx = 0;
    let charIdx = 0;
    let deleting = false;

    function type() {
        const phrase = phrases[phraseIdx];
        if (!deleting) {
            el.textContent = phrase.substring(0, charIdx + 1);
            charIdx++;
            if (charIdx === phrase.length) {
                deleting = true;
                setTimeout(type, 2200);
                return;
            }
        } else {
            el.textContent = phrase.substring(0, charIdx - 1);
            charIdx--;
            if (charIdx === 0) {
                deleting = false;
                phraseIdx = (phraseIdx + 1) % phrases.length;
            }
        }
        setTimeout(type, deleting ? 45 : 75);
    }
    setTimeout(type, 1000);
}

// ─────────────────────────────────────────────────────────────
//  WIZARD NAVIGATION
// ─────────────────────────────────────────────────────────────
function goToStep(step) {
    if (step === 2) {
        const url = document.getElementById('portfolio-url').value.trim();
        // Validate step 1 is fine (role is always selected)
    }
    if (step === 3) {
        const url = document.getElementById('portfolio-url').value.trim();
        if (!url || !isValidUrl(url)) {
            shakeElement('url-input-wrapper');
            document.getElementById('portfolio-url').focus();
            return;
        }
        updateLaunchSummary();
    }

    // Hide current, show next
    document.getElementById(`step-${state.currentStep}`).classList.remove('active');
    document.getElementById(`step-${step}`).classList.add('active');

    // Update progress
    updateProgress(step);
    state.currentStep = step;

    // Scroll wizard into view
    document.getElementById('wizard').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function updateProgress(step) {
    const fill = document.getElementById('progress-fill');
    const pct = { 1: '33.33%', 2: '66.66%', 3: '100%' };
    fill.style.width = pct[step];

    document.querySelectorAll('.progress-step').forEach(el => {
        const s = parseInt(el.dataset.step);
        el.classList.remove('active', 'done');
        if (s === step) el.classList.add('active');
        else if (s < step) el.classList.add('done');
    });
}

function updateLaunchSummary() {
    document.getElementById('ls-role').textContent = state.selectedRole;
    const url = document.getElementById('portfolio-url').value.trim();
    document.getElementById('ls-url').textContent = url;
    document.getElementById('ls-model').textContent = state.selectedModel === 'flash' ? 'Gemini Flash' : 'Gemini Pro';
}

// ─────────────────────────────────────────────────────────────
//  ROLE SELECTION
// ─────────────────────────────────────────────────────────────
function initRoleCards() {
    document.querySelectorAll('.role-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            state.selectedRole = card.dataset.value;
        });
    });
}

// ─────────────────────────────────────────────────────────────
//  MODEL SELECTION
// ─────────────────────────────────────────────────────────────
function selectModel(model) {
    state.selectedModel = model;
    document.querySelectorAll('.model-card').forEach(c => c.classList.remove('selected'));
    document.getElementById(`model-${model}`).classList.add('selected');
}

// ─────────────────────────────────────────────────────────────
//  URL INPUT & GITHUB DETECTION
// ─────────────────────────────────────────────────────────────
function initUrlInput() {
    const input = document.getElementById('portfolio-url');
    const wrapper = document.getElementById('url-input-wrapper');
    const badge = document.getElementById('url-type-badge');
    const ghPreview = document.getElementById('github-preview');
    const icon = document.getElementById('url-icon');

    input.addEventListener('input', () => {
        const url = input.value.trim();
        const isGH = url.toLowerCase().includes('github.com');

        // Update badge
        badge.className = 'url-type-badge';
        if (url.length > 4) {
            if (isGH) {
                badge.textContent = '⚡ GitHub';
                badge.classList.add('github-badge');
                wrapper.classList.add('is-github');
                icon.className = 'fab fa-github';
            } else if (isValidUrl(url)) {
                badge.textContent = '🌐 Web';
                badge.classList.add('web-badge');
                wrapper.classList.remove('is-github');
                icon.className = 'fas fa-link';
            } else {
                badge.textContent = '';
                wrapper.classList.remove('is-github');
                icon.className = 'fas fa-link';
            }
        } else {
            badge.textContent = '';
            wrapper.classList.remove('is-github');
            icon.className = 'fas fa-link';
        }

        // GitHub preview fetch
        if (isGH && isValidUrl(url)) {
            ghPreview.classList.add('visible');
            document.getElementById('gh-loading').classList.remove('hidden');
            document.getElementById('gh-data').classList.add('hidden');

            clearTimeout(state.githubDebounceTimer);
            state.githubDebounceTimer = setTimeout(() => fetchGithubMeta(url), 800);
        } else {
            ghPreview.classList.remove('visible');
        }
    });
}

async function fetchGithubMeta(url) {
    try {
        const resp = await fetch('/github-meta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
        });
        if (!resp.ok) throw new Error('fetch failed');
        const data = await resp.json();
        renderGithubPreview(data);
    } catch (e) {
        document.getElementById('gh-loading').classList.add('hidden');
    }
}

function renderGithubPreview(data) {
    document.getElementById('gh-loading').classList.add('hidden');
    const ghData = document.getElementById('gh-data');
    ghData.classList.remove('hidden');

    document.getElementById('gh-repo-name').textContent = data.full_name || data.name;
    document.getElementById('gh-repo-desc').textContent = data.description || 'No description provided';
    document.getElementById('gh-stars').textContent = formatNumber(data.stars || 0);
    document.getElementById('gh-forks').textContent = formatNumber(data.forks || 0);
    document.getElementById('gh-issues').textContent = formatNumber(data.open_issues || 0);
    document.getElementById('gh-lang').textContent = data.language || 'N/A';

    const topicsEl = document.getElementById('gh-topics');
    topicsEl.innerHTML = '';
    (data.topics || []).slice(0, 6).forEach(t => {
        const el = document.createElement('span');
        el.className = 'gh-topic';
        el.textContent = t;
        topicsEl.appendChild(el);
    });
}

// ─────────────────────────────────────────────────────────────
//  ANALYSIS
// ─────────────────────────────────────────────────────────────
async function analyzePortfolio() {
    if (state.isAnalyzing) return;

    const url = document.getElementById('portfolio-url').value.trim();
    const context = document.getElementById('user-context').value.trim();

    if (!url || !isValidUrl(url)) {
        showError('Please enter a valid URL before launching the analysis.');
        return;
    }

    state.isAnalyzing = true;
    state.portfolioUrl = url;

    // UI: hide wizard & results, show loader
    document.getElementById('wizard').style.display = 'none';
    document.getElementById('results-container').classList.add('hidden');
    document.getElementById('error-message').classList.add('hidden');

    const loader = document.getElementById('loader');
    loader.classList.remove('hidden');
    loader.scrollIntoView({ behavior: 'smooth', block: 'center' });
    startLoaderAnimation();

    try {
        const resp = await fetch('/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url,
                type: state.selectedRole,
                model: state.selectedModel,
                context,
            }),
        });

        const data = await resp.json();
        loader.classList.add('hidden');

        if (data.error) {
            showError(data.error);
            document.getElementById('wizard').style.display = 'block';
            state.isAnalyzing = false;
            return;
        }

        state.lastResult = data;
        renderResults(data);
        saveToHistory(url, state.selectedRole, data);

    } catch (err) {
        loader.classList.add('hidden');
        showError('A network error occurred. Please check your connection and try again.');
        document.getElementById('wizard').style.display = 'block';
        state.isAnalyzing = false;
    }
}

function startLoaderAnimation() {
    const steps = ['lstep-1', 'lstep-2', 'lstep-3'];
    const delays = [0, 3000, 7000];
    steps.forEach((id, i) => {
        document.getElementById(id).classList.remove('active', 'done');
        setTimeout(() => {
            if (i > 0) document.getElementById(steps[i - 1]).classList.replace('active', 'done');
            document.getElementById(id).classList.add('active');
        }, delays[i]);
    });
}

// ─────────────────────────────────────────────────────────────
//  RENDER RESULTS
// ─────────────────────────────────────────────────────────────
function renderResults(data) {
    const resultsPanel = document.getElementById('results-container');
    resultsPanel.classList.remove('hidden');
    resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    document.getElementById('score-model-used').textContent = `Analyzed with ${data.model_used || 'Gemini'}`;

    if (data.structured && data.analysis) {
        renderStructured(data.analysis, data.github_meta);
    } else {
        renderFallback(data.analysis, data.github_meta);
    }

    state.isAnalyzing = false;
}

function renderStructured(analysis, githubMeta) {
    const scores = analysis.scores || {};

    // Animate gauges
    animateGauge('overall', scores.overall || 0);
    animateGauge('technical', scores.technical || 0);
    animateGauge('presentation', scores.presentation || 0);
    animateGauge('branding', scores.branding || 0);

    // Summary
    document.getElementById('ai-summary-text').textContent = analysis.summary || '—';

    // Quick wins
    const qwList = document.getElementById('quick-wins-list');
    qwList.innerHTML = '';
    (analysis.quick_wins || []).forEach(win => {
        const li = document.createElement('li');
        li.textContent = win;
        qwList.appendChild(li);
    });

    // GitHub meta panel
    if (githubMeta) {
        renderGithubMetaPanel(githubMeta);
    }

    const sections = analysis.sections || {};

    // Tabs
    renderSectionTab('overall', sections.overall_impression);
    renderSectionTab('technical', sections.technical_depth);
    renderSectionTab('presentation', sections.presentation);
    renderActionTab(sections.action_plan);

    initTabs();
}

function renderFallback(rawText, githubMeta) {
    // No scores — use placeholder values
    animateGauge('overall', 0);
    animateGauge('technical', 0);
    animateGauge('presentation', 0);
    animateGauge('branding', 0);

    document.getElementById('ai-summary-text').textContent = 'Analysis complete. See the full report below.';

    if (githubMeta) renderGithubMetaPanel(githubMeta);

    const content = document.getElementById('content-overall');
    content.innerHTML = `
        <button class="copy-btn" onclick="copyText('content-overall')">
            <i class="fas fa-copy"></i> Copy
        </button>
        <div>${simpleMarkdownToHtml(rawText)}</div>
    `;

    ['technical', 'presentation'].forEach(tab => {
        document.getElementById(`content-${tab}`).innerHTML = '<p style="color: var(--text-muted);">See the Overview tab for the full analysis.</p>';
    });
    document.getElementById('content-action').innerHTML = '<p style="color: var(--text-muted);">See the Overview tab for action steps.</p>';

    initTabs();
}

function renderSectionTab(tabId, section) {
    const el = document.getElementById(`content-${tabId}`);
    if (!section) { el.innerHTML = '<p style="color: var(--text-muted);">No data available.</p>'; return; }

    const ratingClass = getRatingClass(section.rating);

    let html = `
        <button class="copy-btn" onclick="copyText('content-${tabId}')">
            <i class="fas fa-copy"></i> Copy
        </button>
        <div class="rating-badge ${ratingClass}">
            <i class="fas fa-circle-check"></i> ${section.rating || 'Good'}
        </div>
        <div class="section-content-area">${simpleMarkdownToHtml(section.content || '')}</div>
    `;

    // Highlights
    if (section.highlights && section.highlights.length) {
        html += `<div class="highlights-block">
            <div class="hi-label green"><i class="fas fa-circle-check"></i> Strengths</div>`;
        section.highlights.forEach(h => {
            html += `<div class="hi-item positive"><i class="fas fa-check-circle"></i><span>${h}</span></div>`;
        });
        html += '</div>';
    }

    // Improvements
    if (section.improvements && section.improvements.length) {
        html += `<div class="improvements-block">
            <div class="hi-label amber"><i class="fas fa-triangle-exclamation"></i> Areas to Improve</div>`;
        section.improvements.forEach(i => {
            html += `<div class="hi-item negative"><i class="fas fa-arrow-up-right-dots"></i><span>${i}</span></div>`;
        });
        html += '</div>';
    }

    el.innerHTML = html;
}

function renderActionTab(section) {
    const el = document.getElementById('content-action');
    if (!section) { el.innerHTML = '<p style="color: var(--text-muted);">No action plan available.</p>'; return; }

    let html = `
        <button class="copy-btn" onclick="copyText('content-action')">
            <i class="fas fa-copy"></i> Copy
        </button>
        <div class="section-content-area">${simpleMarkdownToHtml(section.content || '')}</div>
    `;

    (section.steps || []).forEach(step => {
        const priorityClass = `priority-${(step.priority || 'medium').toLowerCase()}`;
        html += `
            <div class="action-step-card">
                <span class="action-priority ${priorityClass}">${step.priority || 'Med'}</span>
                <div class="action-details">
                    <div class="action-title">${step.action || ''}</div>
                    <div class="action-impact">${step.impact || ''}</div>
                    <div class="action-effort">
                        <i class="fas fa-clock"></i> Effort: ${step.effort || 'Medium'}
                    </div>
                </div>
            </div>
        `;
    });

    el.innerHTML = html;
}

function renderGithubMetaPanel(meta) {
    const panel = document.getElementById('github-meta-panel');
    panel.classList.remove('hidden');
    const statsEl = panel.querySelector('.gm-stats');
    statsEl.innerHTML = `
        <div class="gm-stat"><i class="fas fa-star"></i> ${formatNumber(meta.stars || 0)} Stars</div>
        <div class="gm-stat"><i class="fas fa-code-branch"></i> ${formatNumber(meta.forks || 0)} Forks</div>
        <div class="gm-stat"><i class="fas fa-code"></i> ${meta.language || 'N/A'}</div>
        <div class="gm-stat"><i class="fas fa-scale-balanced"></i> ${meta.license || 'No license'}</div>
        <div class="gm-stat"><i class="fas fa-clock"></i> Last push: ${formatDate(meta.last_push)}</div>
        ${meta.has_pages ? '<div class="gm-stat"><i class="fas fa-globe"></i> GitHub Pages</div>' : ''}
    `;
}

// ─────────────────────────────────────────────────────────────
//  SVG GAUGE ANIMATION
// ─────────────────────────────────────────────────────────────
function animateGauge(name, targetScore) {
    const isMain = name === 'overall';
    const fillEl = document.getElementById(`gauge-fill-${name}`);
    const scoreEl = document.getElementById(`gauge-score-${name}`);
    if (!fillEl || !scoreEl) return;

    const circumference = isMain ? 502.65 : 289;
    const duration = 1200;
    const startTime = performance.now();

    // Color the main gauge based on score
    if (isMain) {
        const color = scoreColor(targetScore);
        fillEl.style.stroke = color;
        fillEl.style.filter = `drop-shadow(0 0 8px ${color}66)`;
    }

    function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const current = Math.round(eased * targetScore);
        const offset = circumference - (circumference * current / 100);

        fillEl.style.strokeDashoffset = offset;
        scoreEl.textContent = current;

        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

function scoreColor(score) {
    if (score >= 80) return '#10b981';
    if (score >= 65) return '#06b6d4';
    if (score >= 50) return '#8b5cf6';
    if (score >= 35) return '#f59e0b';
    return '#ef4444';
}

// ─────────────────────────────────────────────────────────────
//  TABS
// ─────────────────────────────────────────────────────────────
function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            btn.classList.add('active');
            document.getElementById(`tab-${tabId}`).classList.remove('hidden');
        });
    });
}

// ─────────────────────────────────────────────────────────────
//  HISTORY (localStorage)
// ─────────────────────────────────────────────────────────────
const HISTORY_KEY = 'portfolioai_history';
const MAX_HISTORY = 5;

function saveToHistory(url, role, data) {
    let history = getHistory();
    const item = {
        id: Date.now(),
        url,
        role,
        date: new Date().toISOString(),
        score: data.structured ? (data.analysis?.scores?.overall || 0) : null,
        data,
    };
    // Remove duplicate URL if exists
    history = history.filter(h => h.url !== url);
    history.unshift(item);
    if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    renderHistory();
}

function getHistory() {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch { return []; }
}

function renderHistory() {
    const history = getHistory();
    const list = document.getElementById('history-list');
    const badge = document.getElementById('history-count');

    if (history.length === 0) {
        list.innerHTML = '<div class="history-empty">No analyses yet. Start your first one!</div>';
        badge.style.display = 'none';
        return;
    }

    badge.style.display = 'flex';
    badge.textContent = history.length;

    list.innerHTML = history.map(item => `
        <div class="history-item" onclick="loadHistory(${item.id})">
            <div class="history-item-url" title="${item.url}">${getDomain(item.url)}</div>
            <div class="history-item-meta">
                <span>${item.role}</span>
                <span>·</span>
                <span>${formatDate(item.date)}</span>
                ${item.score !== null ? `<span>·</span><span class="history-item-score">${item.score}/100</span>` : ''}
            </div>
        </div>
    `).join('');
}

function loadHistory(id) {
    const history = getHistory();
    const item = history.find(h => h.id === id);
    if (!item) return;

    // Populate wizard fields
    document.getElementById('portfolio-url').value = item.url;
    state.selectedRole = item.role;
    state.selectedModel = item.data.model_used?.includes('flash') ? 'flash' : 'pro';

    // Hide wizard, show results
    document.getElementById('wizard').style.display = 'none';
    state.lastResult = item.data;
    renderResults(item.data);

    toggleHistory();
    document.getElementById('results-container').scrollIntoView({ behavior: 'smooth' });
}

function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
}

function toggleHistory() {
    const sidebar = document.getElementById('history-sidebar');
    sidebar.classList.toggle('open');
}

// ─────────────────────────────────────────────────────────────
//  NEW ANALYSIS
// ─────────────────────────────────────────────────────────────
function newAnalysis() {
    document.getElementById('results-container').classList.add('hidden');
    document.getElementById('error-message').classList.add('hidden');
    document.getElementById('wizard').style.display = 'block';

    // Reset to step 1
    document.getElementById(`step-${state.currentStep}`).classList.remove('active');
    document.getElementById('step-1').classList.add('active');
    updateProgress(1);
    state.currentStep = 1;
    state.isAnalyzing = false;

    // Reset GitHub preview
    document.getElementById('github-preview').classList.remove('visible');
    document.getElementById('portfolio-url').value = '';

    document.getElementById('analyzer').scrollIntoView({ behavior: 'smooth' });
}

// ─────────────────────────────────────────────────────────────
//  PDF EXPORT
// ─────────────────────────────────────────────────────────────
function exportPDF() {
    // Show all tabs before printing
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('hidden'));
    window.print();
    // Restore tabs after print dialog closes
    setTimeout(() => {
        document.querySelectorAll('.tab-content').forEach((c, i) => {
            if (i > 0) c.classList.add('hidden');
        });
    }, 1000);
}

// ─────────────────────────────────────────────────────────────
//  COPY TO CLIPBOARD
// ─────────────────────────────────────────────────────────────
function copyText(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const text = el.innerText || el.textContent;
    navigator.clipboard.writeText(text).then(() => {
        const btn = el.querySelector('.copy-btn');
        if (btn) {
            const orig = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            btn.classList.add('copied');
            setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('copied'); }, 2000);
        }
    }).catch(() => {});
}

// ─────────────────────────────────────────────────────────────
//  ERROR DISPLAY
// ─────────────────────────────────────────────────────────────
function showError(message) {
    const el = document.getElementById('error-message');
    document.getElementById('error-text').textContent = message;
    el.classList.remove('hidden');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ─────────────────────────────────────────────────────────────
//  MARKDOWN → HTML (fallback)
// ─────────────────────────────────────────────────────────────
function simpleMarkdownToHtml(text) {
    if (!text) return '';
    let html = text;
    html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    const lines = html.split('\n');
    const result = [];
    let inList = false;
    lines.forEach(line => {
        if (/^[\*\-] /.test(line.trim())) {
            if (!inList) { result.push('<ul>'); inList = true; }
            result.push(`<li>${line.replace(/^[\*\-] /, '').trim()}</li>`);
        } else {
            if (inList) { result.push('</ul>'); inList = false; }
            result.push(line);
        }
    });
    if (inList) result.push('</ul>');
    html = result.join('\n');
    html = html.replace(/\n\s*\n/g, '</p><p>');
    html = '<p>' + html + '</p>';
    html = html.replace(/<p>\s*<\/p>/g, '');
    html = html.replace(/<p>\s*(<[hH]\d>)/g, '$1');
    html = html.replace(/(<\/[hH]\d>)\s*<\/p>/g, '$1');
    html = html.replace(/<p>\s*<ul>/g, '<ul>');
    html = html.replace(/<\/ul>\s*<\/p>/g, '</ul>');
    return html;
}

// ─────────────────────────────────────────────────────────────
//  UTILITIES
// ─────────────────────────────────────────────────────────────
function isValidUrl(url) {
    try { new URL(url); return true; } catch { return false; }
}

function formatNumber(n) {
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
}

function formatDate(iso) {
    if (!iso) return 'Unknown';
    try {
        const d = new Date(iso);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return iso; }
}

function getDomain(url) {
    try {
        const u = new URL(url);
        return u.hostname + (u.pathname !== '/' ? u.pathname : '');
    } catch { return url; }
}

function getRatingClass(rating) {
    const map = {
        'excellent': 'rating-excellent',
        'strong': 'rating-strong',
        'good': 'rating-good',
        'needs work': 'rating-needs',
        'poor': 'rating-poor',
    };
    return map[(rating || '').toLowerCase()] || 'rating-good';
}

function shakeElement(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.animation = 'shake 0.4s ease';
    setTimeout(() => { el.style.animation = ''; }, 500);
}

// ─────────────────────────────────────────────────────────────
//  SCROLL REVEAL
// ─────────────────────────────────────────────────────────────
function initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.step-card, .feature-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(24px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

// ─────────────────────────────────────────────────────────────
//  SMOOTH ANCHOR SCROLLING
// ─────────────────────────────────────────────────────────────
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', e => {
            const target = document.querySelector(a.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

// ─────────────────────────────────────────────────────────────
//  KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────────────────────
function initKeyboard() {
    document.addEventListener('keydown', e => {
        if (e.key === 'Enter' && state.currentStep === 2) {
            const url = document.getElementById('portfolio-url').value.trim();
            if (url && isValidUrl(url)) goToStep(3);
        }
        if (e.key === 'Escape') {
            document.getElementById('history-sidebar').classList.remove('open');
        }
    });
}

// ─────────────────────────────────────────────────────────────
//  INIT
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    initNavbar();
    animateCounters();
    initTypingEffect();
    initRoleCards();
    initUrlInput();
    initScrollReveal();
    initSmoothScroll();
    initKeyboard();
    renderHistory();

    // Hero CTA → scroll to analyzer
    document.getElementById('hero-analyze-btn')?.addEventListener('click', e => {
        e.preventDefault();
        document.getElementById('analyzer').scrollIntoView({ behavior: 'smooth' });
    });
    document.getElementById('nav-analyze-btn')?.addEventListener('click', e => {
        e.preventDefault();
        document.getElementById('analyzer').scrollIntoView({ behavior: 'smooth' });
    });
});
