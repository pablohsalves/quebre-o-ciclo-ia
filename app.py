import os
import json
import logging 
from flask import Flask, render_template, request, jsonify, redirect, url_for, session

# Tenta carregar o cliente Gemini; mantém a importação mesmo se a chave faltar
try:
    from google import genai
    from google.genai import types
except ImportError:
    print("Atenção: A biblioteca google-genai não está instalada.")
    genai = None
    types = None


# --- 1. Configuração do Logger e Arquivos de Dados ---

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s') 
logger = logging.getLogger(__name__)

# ARQUIVOS DE DADOS USADOS PELO PAINEL ADMIN
KNOWLEDGE_FILE = 'knowledge.txt'
RESOURCES_FILE = 'resources.json'
LOGS_FILE = 'logs.txt'
FEEDBACK_FILE = 'feedback.txt'

# Variáveis de Login do Admin
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin") # Default 'admin' se não setado
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "password") # Default 'password' se não setado


def load_file_content(filename, default_content=""):
    """Função auxiliar para ler o conteúdo dos arquivos de dados."""
    try:
        if os.path.exists(filename):
            with open(filename, 'r', encoding='utf-8') as f:
                return f.read()
        else:
            logger.warning(f"Arquivo {filename} não encontrado. Criando com conteúdo padrão.")
            with open(filename, 'w', encoding='utf-8') as f:
                 f.write(default_content)
            return default_content
    except Exception as e:
        logger.error(f"Erro ao ler/criar {filename}: {e}")
        return default_content

def save_file_content(filename, content):
    """Função auxiliar para salvar o conteúdo nos arquivos de dados."""
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    except Exception as e:
        logger.error(f"Erro ao salvar {filename}: {e}")
        return False

# Inicializa o conhecimento interno, que será incluído na SYSTEM_INSTRUCTION
INTERNAL_KNOWLEDGE = load_file_content(KNOWLEDGE_FILE, default_content="Instruções internas padrão.")


# --- 2. Configuração do Flask e Gemini ---

app = Flask(__name__)
# CHAVE SECRETA É OBRIGATÓRIA PARA USAR SESSÕES
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "uma_chave_secreta_muito_forte_para_o_render") 
app.permanent_session_lifetime = 60 * 60 * 24 # 24 horas

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

# --- 3. Rotas de Aplicação ---

@app.route('/')
def index():
    """Renderiza a página inicial do chat."""
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    """
    Processa a requisição de chat do usuário.
    (Lógica mantida como estava, com histórico e logs)
    """
    if not client:
        return jsonify({"response": "Desculpe, a conexão com a IA não está ativa."}), 503

    try:
        data = request.get_json()
        user_message = data.get('message')
        history = data.get('history', [])

        # Lógica de gravação de logs de conversação (opcional, mas bom para rastreio)
        log_line = f"CHAT_LOG: user='{user_message[:100]}...'\n"
        with open(LOGS_FILE, 'a', encoding='utf-8') as f:
            f.write(log_line)


        chat_history = [
            types.Content.from_dict(item) 
            for item in history if 'role' in item and 'parts' in item
        ]
        
        chat_session = client.chats.create(
            model="gemini-2.5-flash",
            history=chat_history,
            config=generation_config
        )

        response = chat_session.send_message(user_message)
        
        return jsonify({"response": response.text})

    except Exception as e:
        logger.error(f"Erro ao processar requisição de chat: {e}", exc_info=True)
        return jsonify({"response": "Desculpe, ocorreu um erro interno ao processar sua solicitação."}), 500


@app.route('/feedback', methods=['POST'])
def feedback():
    """
    Recebe e registra o feedback do usuário (em arquivo feedback.txt).
    """
    try:
        data = request.get_json()
        feedback_type = data.get('type')
        user_prompt = data.get('user_prompt', 'N/A')
        ai_response_text = data.get('ai_response_text', 'N/A')

        if not feedback_type:
            return jsonify({"status": "error", "message": "Tipo de feedback ausente."}), 400

        # Grava no arquivo feedback.txt
        feedback_entry = (
            f"[{feedback_type.upper()}] Prompt: {user_prompt.replace('\n', ' ')} | "
            f"Response: {ai_response_text.replace('\n', ' ')}\n"
        )
        with open(FEEDBACK_FILE, 'a', encoding='utf-8') as f:
            f.write(feedback_entry)

        # Também registra no log padrão do Render
        logger.info(f"FEEDBACK_REGISTRADO: Tipo={feedback_type}") 

        return jsonify({"status": "success", "message": "Feedback registrado com sucesso.", "type": feedback_type}), 200

    except Exception as e:
        logger.error(f"Erro ao processar feedback: {e}", exc_info=True)
        return jsonify({"status": "error", "message": "Erro interno ao processar feedback."}), 500

@app.route('/panic', methods=['POST'])
def panic_redirect():
    """
    Rota simples para acionar o redirecionamento imediato em caso de emergência.
    """
    logger.warning("Botão de Pânico acionado. Redirecionando para o Google.")
    return jsonify({"status": "redirect", "url": "https://www.google.com"}), 200

# --- 4. Rotas Administrativas RECONSTRUÍDAS ---

def login_required(f):
    """Decorator para exigir login em rotas admin."""
    def wrapper(*args, **kwargs):
        if 'logged_in' not in session or not session['logged_in']:
            return redirect(url_for('admin_login'))
        return f(*args, **kwargs)
    wrapper.__name__ = f.__name__ # Necessário para o Flask
    return wrapper


@app.route('/admin/login', methods=['GET', 'POST']) 
def admin_login():
    """Processa o login do administrador."""
    error = None
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            session['logged_in'] = True
            session.permanent = True # Usa a permanência definida acima
            logger.info(f"Login administrativo bem-sucedido para o usuário: {username}")
            return redirect(url_for('admin_painel'))
        else:
            error = 'Credenciais inválidas. Tente novamente.'
            logger.warning(f"Tentativa de login falha para o usuário: {username}")
            
    return render_template('admin_login.html', error=error)


@app.route('/admin/logout')
def admin_logout():
    """Faz o logout do administrador."""
    session.pop('logged_in', None)
    logger.info("Logout administrativo realizado.")
    return redirect(url_for('index'))


@app.route('/admin/painel', methods=['GET', 'POST']) # Aceita POST para salvar dados
@login_required
def admin_painel():
    """Painel principal do administrador: edição de conhecimento e logs."""
    message = None
    
    # --- 1. Processa Submissão de Formulário (POST) ---
    if request.method == 'POST':
        
        # 1.1. Atualizar Conhecimento Interno (knowledge.txt)
        if 'knowledge' in request.form:
            new_knowledge = request.form['knowledge']
            if save_file_content(KNOWLEDGE_FILE, new_knowledge):
                global INTERNAL_KNOWLEDGE
                INTERNAL_KNOWLEDGE = new_knowledge # Atualiza a variável global
                # A nova instrução só será aplicada na próxima execução ou requisição de chat
                message = "Instrução da Jady (knowledge.txt) atualizada com sucesso. Reinicie o servidor para garantir o carregamento completo na IA."
                logger.info("knowledge.txt atualizado via Admin.")
            else:
                message = "ERRO: FALHA ao salvar knowledge.txt."

        # 1.2. Atualizar Fontes de Apoio (resources.json)
        elif 'resources' in request.form:
            new_resources = request.form['resources']
            try:
                # Valida se é um JSON válido antes de salvar
                json.loads(new_resources) 
                if save_file_content(RESOURCES_FILE, new_resources):
                    message = "Fontes de Apoio (resources.json) atualizadas com sucesso."
                    logger.info("resources.json atualizado via Admin.")
                else:
                    message = "ERRO: FALHA ao salvar resources.json."
            except json.JSONDecodeError:
                message = "ERRO: O conteúdo de Fontes de Apoio não é um JSON válido. Verifique a sintaxe."

        # 1.3. Resetar Logs de Conversa (logs.txt)
        elif 'reset_logs' in request.form:
            if save_file_content(LOGS_FILE, ""):
                 message = "Logs de Conversa (logs.txt) RESETADOS com sucesso."
                 logger.warning("Logs de Conversa RESETADOS via Admin.")
            else:
                 message = "ERRO: FALHA ao resetar logs.txt."
                 
        # 1.4. Resetar Feedback (feedback.txt)
        elif 'reset_feedback' in request.form:
            if save_file_content(FEEDBACK_FILE, ""):
                 message = "Feedback (feedback.txt) RESETADO com sucesso."
                 logger.warning("Feedback RESETADO via Admin.")
            else:
                 message = "ERRO: FALHA ao resetar feedback.txt."


    # --- 2. Carrega Dados para o Template (GET ou após POST) ---
    
    # Carrega os conteúdos atuais para exibir nas textareas
    current_knowledge = load_file_content(KNOWLEDGE_FILE)
    current_resources = load_file_content(RESOURCES_FILE, default_content="{}") # Assume default JSON vazio
    current_logs = load_file_content(LOGS_FILE)
    current_feedback = load_file_content(FEEDBACK_FILE)

    return render_template('admin_painel.html',
                           system_instruction=current_knowledge,
                           resources_content=current_resources,
                           logs_content=current_logs,
                           feedback_content=current_feedback,
                           message=message)


# --- 5. Execução ---
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    # Em produção (Render), use host='0.0.0.0'
    app.run(host='0.0.0.0', port=port)