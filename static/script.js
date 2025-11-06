// Referências aos elementos do HTML
const messagesArea = document.getElementById('messages-area');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const resetButton = document.getElementById('reset-button');
const micWrapper = document.getElementById('mic-wrapper'); 
const micIcon = document.getElementById('mic-icon'); 
// NOVO: Referência ao botão de pânico
const panicButton = document.getElementById('panic-button'); 

// --- Variáveis de Segurança ---
let chatHistory = []; 
let activityTimer; // Variável para o temporizador de inatividade
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos em milissegundos

const initialMessage = "Olá! Eu sou a **Jady**, sua assistente de apoio do **Quebre o Ciclo**. Minha missão é te orientar sobre direitos, leis (como a Lei Maria da Penha) e locais de ajuda. Estou aqui para você. Como posso te ajudar hoje?";

// Função de Segurança: Inicia/Reseta o temporizador de inatividade
function startInactivityTimer() {
    clearTimeout(activityTimer);
    activityTimer = setTimeout(clearSensitiveData, INACTIVITY_TIMEOUT_MS);
}

// Função de Segurança: Limpa dados sensíveis (chamada por inatividade ou pânico)
function clearSensitiveData() {
    chatHistory = []; // Apaga o histórico
    userInput.value = ''; // Limpa o input
    // Opcional: Para feedback visual imediato (embora o foco do timer seja a segurança em background)
    // messagesArea.innerHTML = `
    //     <div class="message ia-message">
    //         <p>A sessão foi encerrada por inatividade para garantir sua segurança. Por favor, comece uma nova conversa.</p>
    //     </div>
    // `;
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
    startInactivityTimer(); // INICIA O TEMPORIZADOR
}

// Função para adicionar uma nova mensagem
function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    messageDiv.classList.add(sender === 'user' ? 'user-message' : 'ia-message');
    
    if (sender === 'ia') {
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
    
    if (!text.includes("... (A Jady está a processar)")) {
        chatHistory.push({
            "role": sender === 'user' ? 'user' : 'model',
            "parts": [{ "text": text }]
        });
    }
    
    startInactivityTimer(); // REINICIA O TEMPORIZADOR A CADA MENSAGEM
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
    startInactivityTimer(); // REINICIA O TEMPORIZADOR AO DIGITAR/INTERAGIR
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
        
        messagesArea.removeChild(processingMessage);
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

// NOVO: Função do Botão de Pânico
function activatePanicMode() {
    // 1. Limpa o histórico imediatamente
    clearSensitiveData(); 
    
    // 2. Redireciona para uma página neutra
    window.location.replace("https://www.google.com"); 
}


// --- Event Listeners e Inicialização ---
sendButton.addEventListener('click', sendMessage);
resetButton.addEventListener('click', resetChat); 
micWrapper.addEventListener('click', startVoiceRecognition); 
// NOVO: Listener para o botão de pânico
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