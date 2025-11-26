async function sendQuery() {
    const input = document.getElementById('question');
    const scope = document.getElementById('scope').value;
    const chat = document.getElementById('chat');
    const question = input.value.trim();

    if (!question) return;

    // 1. Add User Message
    chat.innerHTML += `<div class="message user">${question}</div>`;
    input.value = '';
    chat.scrollTop = chat.scrollHeight;

    // 2. Fetch Response
    try {
        const res = await fetch('http://localhost:8787/api/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, topicHint: scope })
        });

        if (!res.ok) throw new Error("Network error");

        const data = await res.json();
        
        // 3. Format Sources
        let sourceHtml = '';
        if (data.contextUsed && data.contextUsed.length > 0) {
            const uniqueSources = [...new Set(data.contextUsed.map(c => new URL(c.source).hostname))];
            sourceHtml = `<div class="source-box">Sources: ${uniqueSources.join(', ')}</div>`;
        }

        // 4. Add Agent Message
        chat.innerHTML += `
            <div class="message agent">
                ${data.answer.replace(/\n/g, '<br>')}
                ${sourceHtml}
            </div>
        `;
    } catch (err) {
        chat.innerHTML += `<div class="message agent" style="color:red">Error: Could not reach the F1 Agent.</div>`;
    }
    chat.scrollTop = chat.scrollHeight;
}