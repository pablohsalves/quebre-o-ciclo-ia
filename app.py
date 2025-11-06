import os
import json
import logging # <-- NOVO: Para registrar logs de feedback
from flask import Flask, render_template, request, jsonify, redirect, url_for
from google import genai
from google.genai import types

# --- 1. Configuração do Logger ---
# Configuração básica de Logging para aparecer nos logs do Render
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s') 
logger = logging.getLogger(__name__)

# --- 2. Configuração do Flask e Gemini ---
app = Flask(__name__)

# Variável de ambiente (Chave da API)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    logger.error("A variável de ambiente GEMINI_API_KEY não está configurada.")
    # Neste ambiente de desenvolvimento/deploy, é melhor levantar um erro se a chave estiver faltando.
    # raise ValueError("GEMINI_API_KEY não configurada.")
    # No entanto, vamos simular a inicialização para que o restante do código compile
    # e depender da verificação dentro da rota para evitar falhas imediatas.
    pass 

# Inicializa o cliente Gemini
try:
    client = genai.Client(api_key=GEMINI_API_KEY)
except Exception as e:
    logger.error(f"Erro ao inicializar o cliente Gemini: {e}")
    client = None

# Configuração do modelo e do sistema
MODEL_NAME = "gemini-2.5-flash"
SYSTEM_INSTRUCTION = """
Você é a Jady, uma assistente virtual de apoio para mulheres em situação de vulnerabilidade, violência doméstica e violência de gênero, parte do projeto "Quebre o Ciclo".

Seu principal objetivo é fornecer informações de forma clara, acolhedora e empática.

Seu foco deve ser em:
1.  **Acolhimento e Empatia:** Use linguagem gentil e de apoio.
2.  **Informação Legal:** Explique direitos, a Lei Maria da Penha (Lei nº 11.340/2006) e o que constitui violência doméstica e familiar.
3.  **Encaminhamento de Ajuda:** Forneça números de emergência (como 180, 190), locais de apoio (Delegacias da Mulher, Centros de Referência) e recursos online relevantes.
4.  **Segurança Digital:** Nunca peça dados pessoais. Se o usuário mencionar uma situação de risco iminente, reforce a necessidade de ligar para o 190 imediatamente.
5.  **Formato:** Use negrito (**) para destacar informações importantes e listas para clareza (use o formato Markdown).

Mantenha as respostas concisas e diretas, mas sempre com um tom de apoio.
"""

# Configuração de Geração (para garantir a segurança e tom)
generation_config = types.GenerateContentConfig(
    system_instruction=SYSTEM_INSTRUCTION,
    temperature=0.7, # Um pouco de criatividade, mas mantendo a factualidade
)

# --- 3. Rotas do Flask ---

@app.route('/')
def index():
    """Renderiza a página inicial do chat."""
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    """
    Processa a requisição de chat do usuário, mantém o histórico 
    e retorna a resposta da IA.
    """
    if not client:
        return jsonify({"response": "Desculpe, a conexão com a IA não está ativa. Por favor, tente mais tarde."}), 503

    try:
        data = request.get_json()
        user_message = data.get('message')
        history = data.get('history', [])

        if not user_message:
            return jsonify({"response": "Por favor, envie uma mensagem."}), 400

        # Mapeia o histórico para o formato Gemini Content
        chat_history = [
            types.Content.from_dict(item) 
            for item in history if 'role' in item and 'parts' in item
        ]
        
        # Cria uma nova sessão de chat com histórico
        chat_session = client.chats.create(
            model=MODEL_NAME,
            history=chat_history,
            config=generation_config
        )

        # Envia a mensagem do usuário (já incluída no histórico da sessão)
        response = chat_session.send_message(user_message)
        
        return jsonify({"response": response.text})

    except Exception as e:
        logger.error(f"Erro ao processar requisição de chat: {e}", exc_info=True)
        return jsonify({"response": "Desculpe, ocorreu um erro interno ao processar sua solicitação."}), 500


# --- 4. Rota de Feedback (CORRIGIDA) ---
@app.route('/feedback', methods=['POST'])
def feedback():
    """
    Recebe e registra o feedback do usuário sobre a última resposta da IA.
    """
    try:
        data = request.get_json()
        
        # 1. Validação e extração de dados
        feedback_type = data.get('type')
        user_prompt = data.get('user_prompt', 'N/A')
        ai_response_text = data.get('ai_response_text', 'N/A')

        if not feedback_type:
            logger.warning("Feedback recebido sem tipo.")
            return jsonify({"status": "error", "message": "Tipo de feedback ausente."}), 400

        # 2. Registro do Log
        # Usamos o logger para registrar o evento. Isso aparecerá nos logs do Render.
        # Limitamos a 80 caracteres para manter o log legível
        log_message = (
            f"FEEDBACK_REGISTRADO: Tipo={feedback_type} | "
            f"Prompt='{user_prompt[:80].replace('\n', ' ')}...' | "
            f"Response='{ai_response_text[:80].replace('\n', ' ')}...'"
        )
        
        # Registra como INFO para fácil rastreamento
        logger.info(log_message) 

        # 3. Retorno para o Front-End
        return jsonify({"status": "success", "message": "Feedback registrado com sucesso.", "type": feedback_type}), 200

    except Exception as e:
        logger.error(f"Erro ao processar feedback: {e}", exc_info=True)
        return jsonify({"status": "error", "message": "Erro interno ao processar feedback."}), 500

# --- 5. Rota de Pânico (Redirecionamento) ---
@app.route('/panic', methods=['POST'])
def panic_redirect():
    """
    Rota simples para acionar o redirecionamento imediato em caso de emergência.
    """
    logger.warning("Botão de Pânico acionado. Redirecionando para o Google.")
    # O redirecionamento é feito principalmente pelo JS do cliente,
    # mas esta rota pode ser um fallback para registro de log no servidor.
    return jsonify({"status": "redirect", "url": "https://www.google.com"}), 200


# --- 6. Execução ---
if __name__ == '__main__':
    # Porta para execução local e para o Render
    port = int(os.environ.get('PORT', 5000))
    # Em produção (Render), use host='0.0.0.0'
    app.run(host='0.0.0.0', port=port)