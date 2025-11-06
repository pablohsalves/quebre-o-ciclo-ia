// Referências aos elementos do HTML
const messagesArea = document.getElementById('messages-area');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const resetButton = document.getElementById('reset-button');
const micWrapper = document.getElementById('mic-wrapper'); 
const micIcon = document.getElementById('mic-icon'); 

// --- Variável Global para o Histórico ---
let chatHistory = []; 

// NOME CORRIGIDO AQUI
const initialMessage = "Olá! Eu sou a **Jady**, sua assistente de apoio do **Quebre o Ciclo**. Minha missão é te orientar sobre direitos, leis (como a Lei Maria da Penha) e locais de ajuda. Estou aqui para você. Como posso te ajudar hoje?";

// Função para iniciar o chat
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
}

// Função para adicionar uma nova mensagem
function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    messageDiv.classList.add(sender === 'user' ? 'user-message' : 'ia-message');
    
    if (sender === 'ia') {
         // Simples substituição para markdown
        const formattedText = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
        messageDiv.innerHTML = `<p>${formattedText}</p>`;
    } else {
        messageDiv.innerHTML = `<p>${text}</p>`;
    }

    messagesArea.appendChild(messageDiv);
    messagesArea.scrollTop = messagesArea.scrollHeight;
    
    // Adiciona ao histórico, exceto mensagens de processamento
    if (!text.includes("... (A Jady está a processar)")) {
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

// Função de verificação para ativar/desativar o botão
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
    
    // Aplica a classe para animação do círculo
    micWrapper.classList.add('recording');
    micIcon.style.color = 'var(--mic-active-color)';

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        userInput.value = transcript; 
        checkInput(); 
        
        // ENVIA A MENSAGEM AUTOMATICAMENTE APÓS A TRANSCRIÇÃO
        sendMessage(); 
    };

    recognition.onerror = (event) => {
        console.error("Erro no reconhecimento de voz:", event.error);
        alert("Não foi possível capturar o áudio. Verifique as permissões do microfone.");
    };
    
    recognition.onend = () => {
        // Remove a classe de animação e restaura a cor
        micWrapper.classList.remove('recording');
        micIcon.style.color = 'var(--brand-color)';
    };

    recognition.start();
}


// Função que envia a mensagem para o backend Python (Flask)
async function sendToBackend(userText) {
    // 1. Simula o processamento da IA
    addMessage("... (A Jady está a processar)", 'ia'); 
    
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
    
    // Limpa o campo de input *após* o envio (mesmo para voz)
    userInput.value = '';
    checkInput(); 
}


// --- Event Listeners e Inicialização ---
sendButton.addEventListener('click', sendMessage);
resetButton.addEventListener('click', resetChat); 
micWrapper.addEventListener('click', startVoiceRecognition); 

userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') { 
        sendMessage();
    }
});
userInput.addEventListener('input', checkInput); 

// Inicializa o chat quando a página carrega
document.addEventListener('DOMContentLoaded', initializeChat);