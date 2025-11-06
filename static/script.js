// Variáveis para rastrear o histórico de chat e a última mensagem da IA para feedback
let chatHistory = [];
let lastUserPrompt = "";
let lastAiResponseText = "";
let isDarkMode = localStorage.getItem('darkMode') === 'enabled';

// --- Elementos DOM ---
const messagesArea = document.getElementById('messages-area');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const resetButton = document.getElementById('reset-button');
const panicButton = document.getElementById('panic-button');
const darkModeToggle = document.getElementById('dark-mode-toggle');

// --- Funções de Renderização e Lógica do Chat (Omitidas para brevidade, mas mantidas as anteriores) ---
function displayMessage(role, text) {
    // ... (função displayMessage anterior)
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    messageDiv.innerHTML = formatMarkdown(text); 
    messagesArea.appendChild(messageDiv);
    
    messagesArea.scrollTop = messagesArea.scrollHeight;

    return messageDiv;
}
function formatMarkdown(text) {
    // ... (função formatMarkdown anterior)
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\n/g, '<br>');
    return text;
}
function addAiFeedbackButtons(messageDiv) {
    // ... (função addAiFeedbackButtons anterior)
    const feedbackDiv = document.createElement('div');
    feedbackDiv.className = 'feedback-buttons';
    feedbackDiv.innerHTML = `
        <i class="fas fa-thumbs-up" data-feedback="positivo"></i>
        <i class="fas fa-thumbs-down" data-feedback="negativo"></i>
    `;
    messageDiv.appendChild(feedbackDiv);
}
function handleFeedbackClick(event) {
    // ... (função handleFeedbackClick anterior)
    const icon = event.target;
    if (!icon.matches('.feedback-buttons i')) return;
    const feedbackType = icon.dataset.feedback;
    const feedbackButtons = icon.closest('.feedback-buttons');
    if (feedbackButtons.classList.contains('disabled')) return;
    feedbackButtons.classList.add('disabled');
    feedbackButtons.querySelectorAll('i').forEach(i => {
        i.style.color = '#ccc';
        i.style.cursor = 'default';
        i.style.pointerEvents = 'none';
    });
    icon.style.color = feedbackType === 'positivo' ? '#28a745' : '#dc3545';
    icon.style.fontWeight = 'bold';
    sendFeedback(feedbackType);
    const thanksMessage = document.createElement('span');
    thanksMessage.textContent = ' Obrigado pelo feedback!';
    thanksMessage.style.marginLeft = '10px';
    thanksMessage.style.fontSize = '0.9em';
    icon.parentNode.parentNode.appendChild(thanksMessage);
}
function sendFeedback(feedbackType) {
    // ... (função sendFeedback anterior)
    fetch('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: feedbackType, user_prompt: lastUserPrompt, ai_response_text: lastAiResponseText })
    })
    .then(response => response.json())
    .then(data => console.log('Feedback enviado:', data))
    .catch(error => console.error('Erro ao enviar feedback:', error));
}
async function sendMessage() {
    // ... (função sendMessage anterior)
    const message = userInput.value.trim();
    if (!message) return;
    userInput.value = '';
    userInput.disabled = true;
    sendButton.style.opacity = '0.5';
    displayMessage('user', message);
    lastUserPrompt = message;
    const typingMessage = displayMessage('ai', '<i class="fas fa-ellipsis-h typing-indicator"></i>');
    chatHistory.push({ role: "user", parts: [{ text: message }] });
    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message, history: chatHistory })
        });
        if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
        const data = await response.json();
        const aiResponse = data.response;
        messagesArea.removeChild(typingMessage);
        const aiMessageDiv = displayMessage('ai', aiResponse);
        chatHistory.push({ role: "model", parts: [{ text: aiResponse }] });
        lastAiResponseText = aiResponse;
        addAiFeedbackButtons(aiMessageDiv);
    } catch (error) {
        console.error('Erro ao comunicar com o servidor:', error);
        messagesArea.removeChild(typingMessage);
        displayMessage('ai', 'Desculpe, não consegui me conectar ao servidor. Por favor, tente novamente ou ligue 190.');
    } finally {
        userInput.disabled = false;
        sendButton.style.opacity = '1';
        userInput.focus();
    }
}
function resetChat() {
    // ... (função resetChat anterior)
    if (confirm('Tem certeza que deseja começar uma nova conversa? O histórico será perdido.')) {
        chatHistory = [];
        messagesArea.innerHTML = '';
        lastUserPrompt = "";
        lastAiResponseText = "";
        addInitialMessage(); 
    }
}

// --- Funções UX/Acessibilidade ---

function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode', isDarkMode);
    localStorage.setItem('darkMode', isDarkMode ? 'enabled' : 'disabled');

    // CORREÇÃO: Altera o ícone corretamente
    const icon = darkModeToggle.querySelector('i');
    if (isDarkMode) {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    }
}

function handlePanicClick() {
    window.location.href = 'https://www.google.com'; 
}

function initializeApp() {
    // 1. Aplica o Modo Escuro se estiver salvo
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        // CORREÇÃO: Aplica o ícone correto na inicialização
        const icon = darkModeToggle.querySelector('i');
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    }
    
    // 2. Adiciona a mensagem inicial da Jady
    addInitialMessage();
    
    // 3. Garante que a área de mensagens esteja visível (foco no input)
    userInput.focus();
}

function addInitialMessage() {
    const welcomeMessage = "Olá! Eu sou a **Jady**, sua assistente de apoio do **Quebre o Ciclo**. Minha missão é te orientar sobre direitos, leis (como a Lei Maria da Penha) e locais de ajuda. Estou aqui para você. Como posso te ajudar hoje?";
    displayMessage('ai', welcomeMessage);
    
    chatHistory.push({ role: "model", parts: [{ text: welcomeMessage }] });
}


// --- Event Listeners ---
sendButton.addEventListener('click', sendMessage);
resetButton.addEventListener('click', resetChat);
panicButton.addEventListener('click', handlePanicClick);
darkModeToggle.addEventListener('click', toggleDarkMode);
messagesArea.addEventListener('click', handleFeedbackClick); 

userInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault(); 
        sendMessage();
    }
});

// Inicializa o app ao carregar
document.addEventListener('DOMContentLoaded', initializeApp);