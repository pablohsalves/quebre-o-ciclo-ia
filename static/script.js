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
// const micWrapper = document.getElementById('mic-wrapper'); // REMOVIDO/DESATIVADO

// --- Funções de Renderização e Lógica do Chat ---

function displayMessage(role, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    messageDiv.innerHTML = formatMarkdown(text); 
    messagesArea.appendChild(messageDiv);
    
    // Rola para a mensagem mais recente
    messagesArea.scrollTop = messagesArea.scrollHeight;

    return messageDiv;
}

function formatMarkdown(text) {
    // Substituições básicas de Markdown para HTML
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\n/g, '<br>');
    
    return text;
}

function addAiFeedbackButtons(messageDiv) {
    const feedbackDiv = document.createElement('div');
    feedbackDiv.className = 'feedback-buttons';
    feedbackDiv.innerHTML = `
        <i class="fas fa-thumbs-up" data-feedback="positivo"></i>
        <i class="fas fa-thumbs-down" data-feedback="negativo"></i>
    `;
    messageDiv.appendChild(feedbackDiv);
}

function handleFeedbackClick(event) {
    const icon = event.target;
    if (!icon.matches('.feedback-buttons i')) return;

    const feedbackType = icon.dataset.feedback;

    // Impede cliques repetidos
    const feedbackButtons = icon.closest('.feedback-buttons');
    if (feedbackButtons.classList.contains('disabled')) return;
    feedbackButtons.classList.add('disabled');

    // Desativa e altera visualmente os botões
    feedbackButtons.querySelectorAll('i').forEach(i => {
        i.style.color = '#ccc';
        i.style.cursor = 'default';
        i.style.pointerEvents = 'none';
    });
    
    icon.style.color = feedbackType === 'positivo' ? '#28a745' : '#dc3545';
    icon.style.fontWeight = 'bold';

    // Envia o feedback para o servidor
    sendFeedback(feedbackType);

    // Adiciona uma mensagem de agradecimento
    const thanksMessage = document.createElement('span');
    thanksMessage.textContent = ' Obrigado pelo feedback!';
    thanksMessage.style.marginLeft = '10px';
    thanksMessage.style.fontSize = '0.9em';
    icon.parentNode.parentNode.appendChild(thanksMessage);
}

function sendFeedback(feedbackType) {
    fetch('/feedback', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            type: feedbackType,
            user_prompt: lastUserPrompt, 
            ai_response_text: lastAiResponseText 
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log('Feedback enviado:', data);
    })
    .catch(error => {
        console.error('Erro ao enviar feedback:', error);
    });
}


async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    // 1. Limpa o input e desativa a interface
    userInput.value = '';
    userInput.disabled = true;
    sendButton.style.opacity = '0.5'; // Visualmente desativa
    
    // 2. Adiciona a mensagem do usuário
    displayMessage('user', message);
    lastUserPrompt = message;

    // 3. Adiciona a mensagem de 'Digitando...'
    const typingMessage = displayMessage('ai', '<i class="fas fa-ellipsis-h typing-indicator"></i>');

    // 4. Adiciona a mensagem do usuário ao histórico 
    chatHistory.push({ role: "user", parts: [{ text: message }] });

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: message, history: chatHistory })
        });

        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }

        const data = await response.json();
        const aiResponse = data.response;
        
        // 5. Remove a mensagem de 'Digitando...'
        messagesArea.removeChild(typingMessage);
        
        // 6. Exibe a resposta real da IA
        const aiMessageDiv = displayMessage('ai', aiResponse);
        
        // 7. Atualiza o histórico e feedback
        chatHistory.push({ role: "model", parts: [{ text: aiResponse }] });
        lastAiResponseText = aiResponse;

        // 8. Adiciona botões de feedback 
        addAiFeedbackButtons(aiMessageDiv);
        
    } catch (error) {
        console.error('Erro ao comunicar com o servidor:', error);
        
        // 9. Remove a mensagem de 'Digitando...' e exibe erro
        messagesArea.removeChild(typingMessage);
        
        // CORREÇÃO: Exibe a mensagem de erro SEM botões de feedback, para não ser enviado
        displayMessage('ai', 'Desculpe, não consegui me conectar ao servidor. Por favor, tente novamente ou ligue 190.');

    } finally {
        // 10. Reativa a interface
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
        
        // Reinicia com a mensagem de boas-vindas
        addInitialMessage(); 
    }
}

// --- Funções UX/Acessibilidade ---

function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode', isDarkMode);
    localStorage.setItem('darkMode', isDarkMode ? 'enabled' : 'disabled');

    // Altera o ícone
    const icon = darkModeToggle.querySelector('i');
    icon.classList.toggle('fa-moon', !isDarkMode);
    icon.classList.toggle('fa-sun', isDarkMode);
}

function handlePanicClick() {
    window.location.href = 'https://www.google.com'; 
}

function initializeApp() {
    // 1. Aplica o Modo Escuro se estiver salvo
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        const icon = darkModeToggle.querySelector('i');
        icon.classList.add('fa-sun');
        icon.classList.remove('fa-moon');
    }
    
    // 2. Adiciona a mensagem inicial da Jady
    addInitialMessage();
    
    // 3. Garante que a área de mensagens esteja visível (foco no input)
    userInput.focus();
}

function addInitialMessage() {
    // Mensagem de boas-vindas (deve ser a mesma que o modelo retorna inicialmente)
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
        event.preventDefault(); // Impede quebra de linha
        sendMessage();
    }
});

// Inicializa o app ao carregar
document.addEventListener('DOMContentLoaded', initializeApp);