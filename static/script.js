// Referências aos elementos do HTML
const messagesArea = document.getElementById('messages-area');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const resetButton = document.getElementById('reset-button');
const micWrapper = document.getElementById('mic-wrapper'); 
const micIcon = document.getElementById('mic-icon'); 
const panicButton = document.getElementById('panic-button'); 

// --- Variáveis de Segurança ---
let chatHistory = []; 
let activityTimer; 
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos em milissegundos
// Variável para armazenar a resposta da IA atual para o feedback
let currentAIResponseData = null; 


const initialMessage = "Olá! Eu sou a **Jady**, sua assistente de apoio do **Quebre o Ciclo**. Minha missão é te orientar sobre direitos, leis (como a Lei Maria da Penha) e locais de ajuda. Estou aqui para você. Como posso te ajudar hoje?";

// Função de Segurança: Inicia/Reseta o temporizador de inatividade
function startInactivityTimer() {
    clearTimeout(activityTimer);
    activityTimer = setTimeout(clearSensitiveData, INACTIVITY_TIMEOUT_MS);
}

// Função de Segurança: Limpa dados sensíveis
function clearSensitiveData() {
    chatHistory = []; 
    userInput.value = ''; 
    console.log("Dados sensíveis limpos por inatividade.");
}

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
    startInactivityTimer(); 
}

// Função para adicionar uma nova mensagem
function addMessage(text, sender, isTypingIndicator = false) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    
    if (isTypingIndicator) {
        // NOVO: Adiciona a estrutura para o Typing Indicator
        messageDiv.classList.add('typing-indicator');
        messageDiv.innerHTML = `
            <span></span>
            <span></span>
            <span></span>
        `;
        messageDiv.removeAttribute('class'); // Remove a classe 'message'
        messageDiv.classList.add('typing-indicator'); // Adiciona a classe correta
        messagesArea.appendChild(messageDiv);
        messagesArea.scrollTop = messagesArea.scrollHeight;
        return messageDiv; // Retorna o elemento para que possa ser removido depois
    }
    
    messageDiv.classList.add(sender === 'user' ? 'user-message' : 'ia-message');
    
    if (sender === 'ia') {
        const formattedText = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
            
        // Adiciona a resposta e o container de feedback
        messageDiv.innerHTML = `
            <p>${formattedText}</p>
            <div class="feedback-container" data-response-text="${text}">
                <i class="fas fa-thumbs-up feedback-icon like" title="Resposta útil"></i>
                <i class="fas fa-thumbs-down feedback-icon dislike" title="Resposta inútil"></i>
                <span class="feedback-message">Obrigado pelo feedback!</span>
            </div>
        `;
        
        // Adiciona listeners para os novos ícones de feedback
        const likeIcon = messageDiv.querySelector('.like');
        const dislikeIcon = messageDiv.querySelector('.dislike');
        
        // Passa o objeto de dados da resposta para os manipuladores
        likeIcon.addEventListener('click', (e) => handleFeedback(e, 'like', currentAIResponseData));
        dislikeIcon.addEventListener('click', (e) => handleFeedback(e, 'dislike', currentAIResponseData));
        
    } else {
        messageDiv.innerHTML = `<p>${text}</p>`;
    }

    messagesArea.appendChild(messageDiv);
    messagesArea.scrollTop = messagesArea.scrollHeight;
    
    if (sender !== 'typing-indicator') {
        // Só adiciona ao histórico se não for o typing indicator
        chatHistory.push({
            "role": sender === 'user' ? 'user' : 'model',
            "parts": [{ "text": text }]
        });
    }
    
    startInactivityTimer(); 
}

// Função para manipular o clique no feedback
async function handleFeedback(event, type, responseData) {
    const icon = event.currentTarget;
    const container = icon.closest('.feedback-container');
    const messageSpan = container.querySelector('.feedback-message');
    
    // Evita o reenvio de feedback
    if (icon.classList.contains('selected')) {
        return;
    }
    
    // Desseleciona e remove a classe 'selected' de ambos os ícones
    container.querySelectorAll('.feedback-icon').forEach(i => {
        i.classList.remove('selected');
        i.style.color = '#a0a0a0'; // Volta à cor padrão
    });
    
    // Seleciona o ícone clicado
    icon.classList.add('selected');

    // Mostra a mensagem de agradecimento
    messageSpan.style.display = 'inline';
    
    // Envia o feedback para o backend
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
    startInactivityTimer(); 
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


// Função que envia a mensagem para o backend Python (Flask)
async function sendToBackend(userText) {
    // NOVO: 1. Adiciona o indicador de digitação
    const typingIndicator = addMessage(null, 'typing-indicator', true);
    
    // Limpa a variável de dados de feedback antes de uma nova resposta
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
        
        // 2. Remove o indicador de digitação
        messagesArea.removeChild(typingIndicator);

        // 3. Salva os dados completos para uso no feedback
        currentAIResponseData = {
            user_prompt: data.user_prompt,
            ai_response_text: data.ai_response_text
        };
        
        // 4. Adiciona a resposta final do Gemini com os botões de feedback
        addMessage(data.response, 'ia');
        
    } catch (error) {
        console.error('Erro na comunicação com o backend:', error);
        // Tenta remover o indicador mesmo em caso de erro
        if (typingIndicator && messagesArea.contains(typingIndicator)) {
            messagesArea.removeChild(typingIndicator);
        }
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

// Função do Botão de Pânico
function activatePanicMode() {
    clearSensitiveData(); 
    window.location.replace("https://www.google.com"); 
}


// --- Event Listeners e Inicialização ---
sendButton.addEventListener('click', sendMessage);
resetButton.addEventListener('click', resetChat); 
micWrapper.addEventListener('click', startVoiceRecognition); 
panicButton.addEventListener('click', activatePanicMode); 

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


// Inicializa o chat quando a página carrega
document.addEventListener('DOMContentLoaded', initializeChat);