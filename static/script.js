// Variáveis de estado
let chatHistory = [];
let lastUserPrompt = "";
let lastAiResponseText = "";
let isDarkMode = localStorage.getItem('darkMode') === 'enabled'; 

// --- Elementos DOM ---
const chatContainer = document.getElementById('chat-container'); 
const messagesArea = document.getElementById('messages-area');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const resetButton = document.getElementById('reset-button');
const panicButton = document.getElementById('panic-button');
const darkModeToggle = document.getElementById('dark-mode-toggle');
const micWrapper = document.getElementById('mic-wrapper'); 
const hideHistoryToggle = document.getElementById('hide-history-toggle'); 

// --- Configuração do Reconhecimento de Voz (Microfone) ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false; 
    recognition.lang = 'pt-BR'; 

    recognition.onstart = function() {
        isListening = true;
        micWrapper.classList.add('listening'); 
        userInput.placeholder = 'Ouvindo... Clique para parar.'; 
    };

    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        userInput.value = transcript;
        sendMessage(); 
    };

    recognition.onerror = function(event) {
        console.error('Erro de reconhecimento de voz:', event.error);
        if (isListening) {
             recognition.stop(); 
        }
    };

    recognition.onend = function() {
        isListening = false;
        micWrapper.classList.remove('listening'); 
        userInput.placeholder = 'Fale com a Jady...';
    };
} else {
    if (micWrapper) {
        micWrapper.style.display = 'none';
        console.warn('Reconhecimento de voz não suportado neste navegador.');
    }
}

function toggleListening() {
    if (!recognition) return;

    if (isListening) {
        recognition.stop();
    } else {
        try {
            recognition.start();
        } catch (e) {
            console.error('Reconhecimento de voz já iniciado ou erro ao tentar iniciar:', e);
        }
    }
}

// --- Funções de Renderização e Lógica do Chat ---

/**
 * Função para falar o texto (Text-to-Speech - TTS)
 * @param {string} text O texto a ser lido em voz alta.
 */
function speakText(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text.replace(/\*\*/g, '')); 
        utterance.lang = 'pt-BR'; 
        window.speechSynthesis.cancel(); 
        window.speechSynthesis.speak(utterance);
    } else {
        console.warn('Text-to-Speech não suportado neste navegador.');
    }
}


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

/**
 * Função que adiciona o botão TTS e os botões de Feedback
 */
function addAiTtsAndFeedback(messageDiv, aiResponseText) {
    const actionDiv = document.createElement('div');
    actionDiv.className = 'ai-actions';
    
    // 1. Botão TTS (Leitura em Voz Alta)
    const ttsButton = document.createElement('i');
    ttsButton.className = 'fas fa-volume-up tts-button';
    ttsButton.title = 'Ouvir resposta';
    ttsButton.onclick = () => speakText(aiResponseText);
    actionDiv.appendChild(ttsButton);

    // 2. Botões de Feedback 
    const feedbackDiv = document.createElement('span'); 
    feedbackDiv.className = 'feedback-buttons';
    feedbackDiv.innerHTML = `<i class="fas fa-thumbs-up" data-feedback="positivo"></i><i class="fas fa-thumbs-down" data-feedback="negativo"></i>`;
    actionDiv.appendChild(feedbackDiv);

    messageDiv.appendChild(actionDiv);
}

function handleFeedbackClick(event) {
    const icon = event.target;
    if (!icon.matches('.ai-actions .feedback-buttons i')) return; 
    
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); 
    }

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
    
    icon.closest('.ai-actions').appendChild(thanksMessage); 
}
function sendFeedback(feedbackType) {
    // A chamada ao servidor para registro de feedback
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
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); 
    }
    
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
        
        // CHAMA A FUNÇÃO QUE ADICIONA TTS + FEEDBACK
        addAiTtsAndFeedback(aiMessageDiv, aiResponse);
        
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
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); 
    }
    
    if (confirm('Tem certeza que deseja começar uma nova conversa? O histórico será perdido.')) {
        chatHistory = [];
        messagesArea.innerHTML = '';
        lastUserPrompt = "";
        lastAiResponseText = "";
        addInitialMessage(); 
    }
}


// --- Funções UX/Acessibilidade ---

// FUNÇÃO ATUALIZADA: Confirmação do Botão de Pânico
function handlePanicClick() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); 
    }
    
    if (confirm('ATENÇÃO: Você tem certeza que deseja sair imediatamente? O histórico será limpo e você será redirecionada para o Google.')) {
        window.location.href = 'https://www.google.com'; 
    }
}

// NOVO: Função para Ocultar/Exibir Histórico Rápido
function toggleHistoryVisibility() {
    chatContainer.classList.toggle('hidden-history');
    const icon = hideHistoryToggle.querySelector('i');
    
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); 
    }
    
    if (chatContainer.classList.contains('hidden-history')) {
        hideHistoryToggle.classList.add('active');
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
        hideHistoryToggle.title = 'Exibir Histórico';
    } else {
        hideHistoryToggle.classList.remove('active');
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
        hideHistoryToggle.title = 'Ocultar Histórico Rápido';
    }
}

function applyDarkMode(enable) {
    if (!darkModeToggle) return; 
    
    const icon = darkModeToggle.querySelector('i');
    document.body.classList.toggle('dark-mode', enable);

    if (enable) {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    }
}

function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    applyDarkMode(isDarkMode);
    localStorage.setItem('darkMode', isDarkMode ? 'enabled' : 'disabled');
}

function initializeApp() {
    applyDarkMode(isDarkMode);
    addInitialMessage();
    userInput.focus();
}

function addInitialMessage() {
    const welcomeMessage = "Olá! Eu sou a **Jady**, sua assistente de apoio do **Quebre o Ciclo**. Minha missão é te orientar sobre direitos, leis (como a Lei Maria da Penha) e locais de ajuda. Estou aqui para você. Como posso te ajudar hoje?";
    displayMessage('ai', welcomeMessage);
    chatHistory.push({ role: "model", parts: [{ text: welcomeMessage }] });
}


// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // Funções principais
    sendButton.addEventListener('click', sendMessage);
    resetButton.addEventListener('click', resetChat);
    panicButton.addEventListener('click', handlePanicClick);
    // O listener de feedback deve ser no messagesArea para capturar cliques nos botões recém-criados
    messagesArea.addEventListener('click', handleFeedbackClick); 

    // Listener Crítico do Modo Escuro
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', toggleDarkMode);
    }
    
    // Listener Microfone
    if (micWrapper) {
        micWrapper.addEventListener('click', toggleListening);
    }
    
    // NOVO Listener Ocultar Histórico
    if (hideHistoryToggle) {
        hideHistoryToggle.addEventListener('click', toggleHistoryVisibility);
    }
    
    // Listener do Enter
    userInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault(); 
            sendMessage();
        }
    });

    // Inicializa o app
    initializeApp();
});