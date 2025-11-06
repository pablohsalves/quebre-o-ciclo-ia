import os
import json
import logging 
from flask import Flask, render_template, request, jsonify, redirect, url_for

# Tenta carregar o cliente Gemini; mantém a importação mesmo se a chave faltar
try:
    from google import genai
    from google.genai import types
except ImportError:
    # Se a biblioteca não estiver instalada (improvável no Render, mas bom para local)
    print("Atenção: A biblioteca google-genai não está instalada.")
    genai = None
    types = None


# --- 1. Configuração do Logger e Conhecimento Interno ---

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s') 
logger = logging.getLogger(__name__)

def load_internal_knowledge(filename='knowledge.txt'):
    """
    Carrega o texto do arquivo knowledge.txt, se existir.
    Caso contrário, retorna uma string vazia.
    """
    try:
        # Verifica se o arquivo existe no diretório raiz do projeto
        if os.path.exists(filename):
            with open(filename, 'r', encoding='utf-8') as f:
                content = f.read()
                logger.info(f"Conhecimento interno carregado de {filename} ({len(content)} caracteres).")
                # Retorna o conteúdo para ser usado na System Instruction
                return content + "\n\n--- DIRETRIZES EXTRAS ---\n\n"
        else:
            logger.warning(f"Arquivo de conhecimento interno {filename} não encontrado. Usando apenas instruções fixas.")
            return ""
    except Exception as e:
        logger.error(f"Erro ao ler knowledge.txt: {e}")
        return ""

# Carrega o conhecimento uma vez na inicialização
INTERNAL_KNOWLEDGE = load_internal_knowledge()


# --- 2. Configuração do Flask e Gemini ---

app = Flask(__name__)

# Variável de ambiente (Chave da API)
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    logger.error("A variável de ambiente GEMINI_API_KEY não está configurada.")

# Inicializa o cliente Gemini
client = None
if genai and GEMINI_API_KEY:
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        logger.error(f"Erro ao inicializar o cliente Gemini: {e}")


# Junta o conhecimento interno (lido do arquivo) com as regras fixas
SYSTEM_INSTRUCTION = INTERNAL_KNOWLEDGE + """
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
    temperature=0.7, 
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
        return jsonify({"response": "Desculpe, a conexão com a IA não está ativa. Chave de API ausente ou erro de inicialização."}), 503

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
            model="gemini-2.5-flash",
            history=chat_history,
            config=generation_config
        )

        # Envia a mensagem do usuário (já incluída no histórico da sessão)
        response = chat_session.send_message(user_message)
        
        return jsonify({"response": response.text})

    except Exception as e:
        logger.error(f"Erro ao processar requisição de chat: {e}", exc_info=True)
        return jsonify({"response": "Desculpe, ocorreu um erro interno ao processar sua solicitação."}), 500


@app.route('/feedback', methods=['POST'])
def feedback():
    """
    Recebe e registra o feedback do usuário sobre a última resposta da IA.
    """
    try:
        data = request.get_json()
        feedback_type = data.get('type')
        user_prompt = data.get('user_prompt', 'N/A')
        ai_response_text = data.get('ai_response_text', 'N/A')

        if not feedback_type:
            logger.warning("Feedback recebido sem tipo.")
            return jsonify({"status": "error", "message": "Tipo de feedback ausente."}), 400

        # Registro do Log
        log_message = (
            f"FEEDBACK_REGISTRADO: Tipo={feedback_type} | "
            f"Prompt='{user_prompt[:80].replace('\n', ' ')}...' | "
            f"Response='{ai_response_text[:80].replace('\n', ' ')}...'"
        )
        logger.info(log_message) 

        return jsonify({"status": "success", "message": "Feedback registrado com sucesso.", "type": feedback_type}), 200

    except Exception as e:
        logger.error(f"Erro ao processar feedback: {e}", exc_info=True)
        return jsonify({"status": "error", "message": "Erro interno ao processar feedback."}), 500

# --- Rotas Administrativas REESTABELECIDAS ---
# Estas rotas assumem que você tem os arquivos HTML correspondentes em /templates
@app.route('/admin/login')
def admin_login():
    """Renderiza a página de login administrativa."""
    # NÃO inclui lógica de autenticação
    return render_template('admin_login.html')

@app.route('/admin/painel')
def admin_painel():
    """Renderiza o painel administrativo."""
    # NÃO inclui lógica de autenticação
    return render_template('admin_painel.html')

@app.route('/panic', methods=['POST'])
def panic_redirect():
    """
    Rota simples para acionar o redirecionamento imediato em caso de emergência.
    """
    logger.warning("Botão de Pânico acionado. Redirecionando para o Google.")
    return jsonify({"status": "redirect", "url": "https://www.google.com"}), 200


# --- 4. Execução ---
if __name__ == '__main__':
    # Porta para execução local e para o Render
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)