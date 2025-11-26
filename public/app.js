// --- Configuration ---
// Ensure this matches your Wrangler Terminal output (e.g., 8787 or 53212)
const API_URL = 'http://localhost:8787/api/query';

const chatBox = document.getElementById('chat-box');
const sendBtn = document.getElementById('send-btn');
const inputField = document.getElementById('question-input');
const scopeSelect = document.getElementById('scope-select');

// Helper: Create and scroll to typing indicator
let typingIndicator = null;

function showTyping() {
    if (typingIndicator) return; // Already showing
    
    typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.style.display = 'block';
    typingIndicator.innerHTML = '<span></span><span></span><span></span>';
    
    chatBox.appendChild(typingIndicator);
    chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
}

function hideTyping() {
    if (typingIndicator) {
        typingIndicator.remove();
        typingIndicator = null;
    }
}

// Helper: Append a message to the UI
function appendMessage(text, type, sources = []) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type}`;

    // Format text: convert **bold** to <b>bold</b>
    let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    formattedText = formattedText.replace(/\n/g, '<br>');
    
    msgDiv.innerHTML = formattedText;

    // Append sources if available (AI only)
    if (sources && sources.length > 0) {
        const sourceDiv = document.createElement('div');
        sourceDiv.className = 'sources';
        // Clean source URLs to just show domain
        const cleanSources = sources.map(url => {
            try { return new URL(url).hostname.replace('www.', ''); } 
            catch { return url; }
        });
        // Remove duplicates and join
        sourceDiv.innerText = 'Sources: ' + [...new Set(cleanSources)].join(', ');
        msgDiv.appendChild(sourceDiv);
    }

    chatBox.appendChild(msgDiv);
    chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
}

// Main Logic: Send Query
async function sendQuery() {
    const question = inputField.value.trim();
    const scope = scopeSelect.value;

    if (!question) return;

    // 1. Show User Message
    appendMessage(question, 'user');
    inputField.value = '';

    // 2. Show Typing Indicator
    showTyping();

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, topicHint: scope })
        });

        const data = await response.json();

        // 3. Hide Typing Indicator
        hideTyping();

        // 4. Show AI Response
        if (data.answer) {
            appendMessage(data.answer, 'ai', data.contextUsed ? data.contextUsed.map(c => c.source) : []);
        } else {
            appendMessage("⚠️ Sorry, I encountered an error processing that request.", 'ai');
        }

    } catch (error) {
        hideTyping();
        console.error(error);
        appendMessage("⚠️ Network Error: Please check if the backend server is running.", 'ai');
    }
}

// Event Listeners
sendBtn.addEventListener('click', sendQuery);
inputField.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendQuery();
});