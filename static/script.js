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
const micWrapper = document.getElementById('mic-wrapper'); 

// --- Configuração do Reconhecimento de Voz ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false; // Captura apenas uma frase por vez
    recognition.lang = 'pt-BR'; 

    recognition.onstart = function() {
        isListening = true;
        micWrapper.style.color = 'red'; // Indica que está gravando
        userInput.placeholder = 'Ouvindo...';
    };

    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        userInput.value = transcript;
        sendMessage(); // Envia automaticamente após a transcrição
    };

    recognition.onerror = function(event) {
        console.error('Erro de reconhecimento de voz:', event.error);
        userInput.placeholder = 'Fale com a Jady...';
        micWrapper.style.color = '#ff69b4'; 
        isListening = false;
        alert(`Erro de Microfone: ${event.error}. Verifique se as permissões estão ativadas e se você está usando HTTPS.`);
    };

    recognition.onend = function() {
        if (isListening) {
             micWrapper.style.color = '#ff69b4';
             userInput.placeholder = 'Fale com a Jady...';
             isListening = false;
        }
    };
} else {
    // Se o navegador não suportar, desativa visualmente o microfone
    if (micWrapper) {
        micWrapper.style.display = 'none';
        console.warn('Reconhecimento de voz não suportado neste navegador.');
    }
}

function startListening() {
    if (recognition && !isListening) {
        try {
            recognition.start();
        } catch (e) {
            console.error('Reconhecimento de voz já iniciado ou erro:', e);
        }
    }
}

// --- Funções de Renderização e Lógica do Chat (Mantido) ---
function displayMessage(role, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    messageDiv.innerHTML = formatMarkdown(text); 
    messagesArea.appendChild(messageDiv);
    messagesArea.scrollTop = messagesArea.scrollHeight;
    return messageDiv;
}
function formatMarkdown(text) {
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\n/g, '<br>');
    return text;
}
function addAiFeedbackButtons(messageDiv) {
    const feedbackDiv = document.createElement('div');
    feedbackDiv.className = 'feedback-buttons';
    feedbackDiv.innerHTML = `<i class="fas fa-thumbs-up" data-feedback="positivo"></i><i class="fas fa-thumbs-down" data-feedback="negativo"></i>`;
    messageDiv.appendChild(feedbackDiv);
}
// Funções handleFeedbackClick, sendFeedback e resetChat (mantidas) ...
function handleFeedbackClick(event) {
    const icon = event.target;
    if (!icon.matches('.feedback-buttons i')) return;
    const feedbackType = icon.dataset.feedback;
    const feedbackButtons = icon.closest('.feedback-buttons');
    if (feedbackButtons.classList.contains('disabled')) return;
    feedbackButtons.classList.add('disabled');
    feedbackButtons.querySelectorAll('i').forEach(i => { i.style.color = '#ccc'; i.style.cursor = 'default'; i.style.pointerEvents = 'none'; });
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
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        const icon = darkModeToggle.querySelector('i');
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    }
    addInitialMessage();
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

// Listener para o microfone
if (micWrapper) {
    micWrapper.addEventListener('click', startListening);
}

userInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault(); 
        sendMessage();
    }
});

// Inicializa o app ao carregar
document.addEventListener('DOMContentLoaded', initializeApp);