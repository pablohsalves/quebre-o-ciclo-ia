// Referências aos elementos do HTML
const messagesArea = document.getElementById('messages-area');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const resetButton = document.getElementById('reset-button');
const micWrapper = document.getElementById('mic-wrapper'); 
const micIcon = document.getElementById('mic-icon'); 
const panicButton = document.getElementById('panic-button'); 
// NOVO: Referência ao toggle de Dark Mode
const darkModeToggle = document.getElementById('dark-mode-toggle'); 


// --- Variáveis de Segurança ---
let chatHistory = []; 
let activityTimer; 
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos em milissegundos
let currentAIResponseData = null; 

const initialMessage = "Olá! Eu sou a **Jady**, sua assistente de apoio do **Quebre o Ciclo**. Minha missão é te orientar sobre direitos, leis (como a Lei Maria da Penha) e locais de ajuda. Estou aqui para você. Como posso te ajudar hoje?";

// --- FUNÇÃO DE ACESSIBILIDADE: Dark Mode ---
function setupDarkMode() {
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        // Muda o ícone para Sol (Sun)
        darkModeToggle.querySelector('i').classList.replace('fa-moon', 'fa-sun');
    } else {
        document.body.classList.remove('dark-mode');
        // Muda o ícone para Lua (Moon)
        darkModeToggle.querySelector('i').classList.replace('fa-sun', 'fa-moon');
    }
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
    
    // Altera o ícone de lua para sol e vice-versa
    if (isDarkMode) {
        darkModeToggle.querySelector('i').classList.replace('fa-moon', 'fa-sun');
    } else {
        darkModeToggle.querySelector('i').classList.replace('fa-sun', 'fa-moon');
    }
}


// --- Funções de Segurança ---
function startInactivityTimer() {
    clearTimeout(activityTimer);
    activityTimer = setTimeout(clearSensitiveData, INACTIVITY_TIMEOUT_MS);
}

function clearSensitiveData() {
    chatHistory = []; 
    userInput.value = ''; 
    console.log("Dados sensíveis limpos por inatividade.");
}

// --- Funções do Chat ---
function initializeChat() {
    if (messagesArea.children.length === 0 || !messagesArea.children[0].classList.contains('ia-message')) {
        messagesArea.innerHTML = `
            <div class="message ia-message">
                <p>${initialMessage}</p>
            </div>
        `;
    }
    
    chatHistory = [
        { "role": "model", "parts": [{ "text": initialMessage }] }
    ];
    checkInput(); 
    startInactivityTimer(); 
}

function addMessage(text, sender, isTypingIndicator = false) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    
    if (isTypingIndicator) {
        messageDiv.classList.add('typing-indicator');
        messageDiv.innerHTML = `
            <span></span>
            <span></span>
            <span></span>
        `;
        messageDiv.removeAttribute('class'); 
        messageDiv.classList.add('typing-indicator'); 
        messagesArea.appendChild(messageDiv);
        messagesArea.scrollTop = messagesArea.scrollHeight;
        return messageDiv; 
    }
    
    messageDiv.classList.add(sender === 'user' ? 'user-message' : 'ia-message');
    
    if (sender === 'ia') {
        const formattedText = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
            
        messageDiv.innerHTML = `
            <p>${formattedText}</p>
            <div class="feedback-container" data-response-text="${text}">
                <i class="fas fa-thumbs-up feedback-icon like" title="Resposta útil"></i>
                <i class="fas fa-thumbs-down feedback-icon dislike" title="Resposta inútil"></i>
                <span class="feedback-message">Obrigado pelo feedback!</span>
            </div>
        `;
        
        const likeIcon = messageDiv.querySelector('.like');
        const dislikeIcon = messageDiv.querySelector('.dislike');
        
        // Se a resposta final da Jady for esta, adiciona o listener de feedback
        if(currentAIResponseData && currentAIResponseData.ai_response_text === text) {
             likeIcon.addEventListener('click', (e) => handleFeedback(e, 'like', currentAIResponseData));
             dislikeIcon.addEventListener('click', (e) => handleFeedback(e, 'dislike', currentAIResponseData));
        }
        
    } else {
        messageDiv.innerHTML = `<p>${text}</p>`;
    }

    messagesArea.appendChild(messageDiv);
    messagesArea.scrollTop = messagesArea.scrollHeight;
    
    if (sender !== 'typing-indicator' && text && !text.includes("... (A Jady está a processar)")) {
        chatHistory.push({
            "role": sender === 'user' ? 'user' : 'model',
            "parts": [{ "text": text }]
        });
    }
    
    startInactivityTimer(); 
}

async function handleFeedback(event, type, responseData) {
    const icon = event.currentTarget;
    const container = icon.closest('.feedback-container');
    const messageSpan = container.querySelector('.feedback-message');
    
    if (icon.classList.contains('selected')) {
        return;
    }
    
    container.querySelectorAll('.feedback-icon').forEach(i => {
        i.classList.remove('selected');
        i.style.color = '#a0a0a0'; 
    });
    
    icon.classList.add('selected');

    messageSpan.style.display = 'inline';
    
    try {
        await fetch('/feedback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                type: type,
                user_prompt: responseData.user_prompt,
                ai_response_text: responseData.ai_response_text
            })
        });
    } catch (error) {
        console.error('Erro ao enviar feedback para o backend:', error);
    }
}

function resetChat() {
    messagesArea.innerHTML = ''; 
    initializeChat(); 
    userInput.value = '';
    checkInput();
    alert("Chat reiniciado. Uma nova conversa foi iniciada.");
}

function checkInput() {
    sendButton.disabled = userInput.value.trim() === '';
    
    if (sendButton.disabled) {
        sendButton.style.opacity = 0.5;
        sendButton.style.cursor = 'default';
    } else {
        sendButton.style.opacity = 1.0;
        sendButton.style.cursor = 'pointer';
    }
    startInactivityTimer(); 
}

function startVoiceRecognition() {
    if (!('webkitSpeechRecognition' in window)) {
        alert("Desculpe, seu navegador não suporta o reconhecimento de voz. Por favor, use Chrome ou Edge.");
        return;
    }

    const recognition = new webkitSpeechRecognition();
    recognition.continuous = false; 
    recognition.lang = 'pt-BR'; 
    
    micWrapper.classList.add('recording');
    micIcon.style.color = 'var(--mic-active-color)';

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        userInput.value = transcript; 
        checkInput(); 
        sendMessage(); 
    };

    recognition.onerror = (event) => {
        console.error("Erro no reconhecimento de voz:", event.error);
        alert("Não foi possível capturar o áudio. Verifique as permissões do microfone.");
    };
    
    recognition.onend = () => {
        micWrapper.classList.remove('recording');
        micIcon.style.color = 'var(--brand-color)';
    };

    recognition.start();
}


async function sendToBackend(userText) {
    const typingIndicator = addMessage(null, 'typing-indicator', true);
    
    currentAIResponseData = null;
    
    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                message: userText,
                history: chatHistory 
            })
        });

        const data = await response.json();
        
        messagesArea.removeChild(typingIndicator);

        currentAIResponseData = {
            user_prompt: data.user_prompt,
            ai_response_text: data.ai_response_text
        };
        
        addMessage(data.response, 'ia');
        
    } catch (error) {
        console.error('Erro na comunicação com o backend:', error);
        if (typingIndicator && messagesArea.contains(typingIndicator)) {
            messagesArea.removeChild(typingIndicator);
        }
        addMessage("Desculpe, não consegui me conectar ao servidor. Por favor, tente novamente.", 'ia');
    }
}


function sendMessage() {
    const userText = userInput.value.trim();

    if (userText === "" || sendButton.disabled) {
        return;
    }

    addMessage(userText, 'user');
    sendToBackend(userText);
    
    userInput.value = '';
    checkInput(); 
}

function activatePanicMode() {
    clearSensitiveData(); 
    window.location.replace("https://www.google.com"); 
}


// --- Event Listeners e Inicialização ---
sendButton.addEventListener('click', sendMessage);
resetButton.addEventListener('click', resetChat); 
micWrapper.addEventListener('click', startVoiceRecognition); 
panicButton.addEventListener('click', activatePanicMode); 
// NOVO: Listener para o Dark Mode
darkModeToggle.addEventListener('click', toggleDarkMode); 

userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') { 
        sendMessage();
    }
});
userInput.addEventListener('input', checkInput); 

// Adiciona listeners para rastrear a atividade e reiniciar o timer (Gatilhos de segurança)
document.addEventListener('mousemove', startInactivityTimer);
document.addEventListener('keypress', startInactivityTimer);
document.addEventListener('touchstart', startInactivityTimer);


// Inicializa o chat e o Dark Mode quando a página carrega
document.addEventListener('DOMContentLoaded', () => {
    setupDarkMode(); // Configura o modo escuro antes de inicializar o chat
    initializeChat();
});