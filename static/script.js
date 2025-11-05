// Referências aos elementos do HTML
const messagesArea = document.getElementById('messages-area');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const resetButton = document.getElementById('reset-button'); // Novo botão de reset

// Função para adicionar uma nova mensagem à área de chat
function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    messageDiv.classList.add(sender === 'user' ? 'user-message' : 'ia-message');
    messageDiv.innerHTML = `<p>${text}</p>`;
    
    messagesArea.appendChild(messageDiv);
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

// NOVO: Função para limpar a conversa (Reset)
function resetChat() {
    // Remove todas as mensagens, exceto a primeira (boas-vindas da IA)
    while (messagesArea.children.length > 1) {
        messagesArea.removeChild(messagesArea.lastChild);
    }
    // Restaura a mensagem de boas-vindas se ela foi removida (caso improvável, mas seguro)
    if (messagesArea.children.length === 0) {
        messagesArea.innerHTML = `
            <div class="message ia-message">
                <p>Olá! Eu sou a **Força Feminina**, sua assistente de apoio do **Quebre o Ciclo**. Minha missão é te orientar sobre direitos, leis (como a Lei Maria da Penha) e locais de ajuda. Estou aqui para você. Como posso te ajudar hoje?</p>
            </div>
        `;
    }
    userInput.value = '';
    checkInput(); // Redefine o estado do botão
    messagesArea.scrollTop = 0;
    alert("Chat reiniciado. Uma nova conversa foi iniciada.");
}

// Função de verificação para ativar/desativar o botão (Melhoria de UX)
function checkInput() {
    sendButton.disabled = userInput.value.trim() === '';
    
    // Controla o visual
    if (sendButton.disabled) {
        sendButton.style.opacity = 0.5;
        sendButton.style.cursor = 'default';
    } else {
        sendButton.style.opacity = 1.0;
        sendButton.style.cursor = 'pointer';
    }
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
            body: JSON.stringify({ message: userText })
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
    checkInput(); // Desabilita o botão após o envio
}

// Event Listeners
sendButton.addEventListener('click', sendMessage);
resetButton.addEventListener('click', resetChat); // Evento para o novo botão de reset

userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') { 
        sendMessage();
    }
});
userInput.addEventListener('input', checkInput); 

// Chame a função uma vez ao carregar para definir o estado inicial
checkInput();