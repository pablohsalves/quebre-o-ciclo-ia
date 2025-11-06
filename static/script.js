// Referências aos elementos do HTML
const messagesArea = document.getElementById('messages-area');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const resetButton = document.getElementById('reset-button');
const micIcon = document.getElementById('mic-icon'); 

// --- Variável Global para o Histórico ---
let chatHistory = []; 

// ALTERAÇÃO AQUI: Nome da assistente alterado para Jady
const initialMessage = "Olá! Eu sou a **Jady**, sua assistente de apoio do **Quebre o Ciclo**. Minha missão é te orientar sobre direitos, leis (como a Lei Maria da Penha) e locais de ajuda. Estou aqui para você. Como posso te ajudar hoje?";

// Função para iniciar o chat com a mensagem da IA e preencher o histórico
function initializeChat() {
    // 1. Garante que a mensagem inicial da IA está no chat (se ainda não estiver)
    if (messagesArea.children.length === 0 || !messagesArea.children[0].classList.contains('ia-message')) {
        messagesArea.innerHTML = `
            <div class="message ia-message">
                <p>${initialMessage}</p>
            </div>
        `;
    }
    
    // 2. Preenche o histórico com a mensagem inicial da IA (para que a IA se lembre de quem ela é)
    chatHistory = [
        { "role": "model", "parts": [{ "text": initialMessage }] }
    ];
    checkInput(); 
}


// Função para adicionar uma nova mensagem à área de chat
function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    messageDiv.classList.add(sender === 'user' ? 'user-message' : 'ia-message');
    messageDiv.innerHTML = `<p>${text}</p>`;
    
    messagesArea.appendChild(messageDiv);
    messagesArea.scrollTop = messagesArea.scrollHeight;
    
    // Adiciona a mensagem ao histórico global (se não for a mensagem de processamento)
    if (!text.includes("... (A Força Feminina está a processar)")) {
        chatHistory.push({
            "role": sender === 'user' ? 'user' : 'model',
            "parts": [{ "text": text }]
        });
    }
}

// Função para limpar a conversa (Reset)
function resetChat() {
    messagesArea.innerHTML = ''; 
    initializeChat(); 
    userInput.value = '';
    checkInput();
    alert("Chat reiniciado. Uma nova conversa foi iniciada.");
}

// Função de verificação para ativar/desativar o botão (Melhoria de UX)
function checkInput() {
    sendButton.disabled = userInput.value.trim() === '';
    
    if (sendButton.disabled) {
        sendButton.style.opacity = 0.5;
        sendButton.style.cursor = 'default';
    } else {
        sendButton.style.opacity = 1.0;
        sendButton.style.cursor = 'pointer';
    }
}

// --- Função para Reconhecimento de Voz (Speech-to-Text) ---
function startVoiceRecognition() {
    if (!('webkitSpeechRecognition' in window)) {
        alert("Desculpe, seu navegador não suporta o reconhecimento de voz. Por favor, use Chrome ou Edge.");
        return;
    }

    const recognition = new webkitSpeechRecognition();
    recognition.continuous = false; 
    recognition.lang = 'pt-BR'; 
    
    micIcon.style.color = '#ff0000'; 
    micIcon.classList.add('pulse');

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        userInput.value = transcript; 
        checkInput(); 
    };

    recognition.onerror = (event) => {
        console.error("Erro no reconhecimento de voz:", event.error);
    };
    
    recognition.onend = () => {
        micIcon.style.color = 'var(--brand-color)';
        micIcon.classList.remove('pulse');
    };

    recognition.start();
}


// Função que envia a mensagem para o backend Python (Flask)
async function sendToBackend(userText) {
    // 1. Simula o processamento da IA
    addMessage("... (A Força Feminina está a processar)", 'ia'); 
    
    const processingMessage = messagesArea.lastChild; 
    
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
        
        // 2. Remove a mensagem de processamento
        messagesArea.removeChild(processingMessage);

        // 3. Adiciona a resposta final do Gemini
        addMessage(data.response, 'ia');
        
    } catch (error) {
        console.error('Erro na comunicação com o backend:', error);
        messagesArea.removeChild(processingMessage); 
        addMessage("Desculpe, não consegui me conectar ao servidor. Por favor, tente novamente.", 'ia');
    }
}


// Função principal de envio
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


// --- Event Listeners e Inicialização ---
sendButton.addEventListener('click', sendMessage);
resetButton.addEventListener('click', resetChat); 
micIcon.addEventListener('click', startVoiceRecognition); 

userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') { 
        sendMessage();
    }
});
userInput.addEventListener('input', checkInput); 

// Inicializa o chat quando a página carrega
document.addEventListener('DOMContentLoaded', initializeChat);