import os
import datetime
import json # NOVO: Necessário para trabalhar com JSON
from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from google import genai
from google.genai import types

# --- Configurações Iniciais ---
app = Flask(__name__)
# Chave de sessão para login admin
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'sua_chave_secreta_padrao') 

# Credenciais Admin (Mudar no ambiente de produção)
ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', 'admin')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'senha123')

# Configuração Gemini API
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError("A variável de ambiente GEMINI_API_KEY não está definida.")

client = genai.Client(api_key=GEMINI_API_KEY)

# --- Caminhos de Arquivo ---
KNOWLEDGE_FILE = 'knowledge.txt'
LOGS_FILE = 'logs.txt'
FEEDBACK_FILE = 'feedback.txt'
RESOURCES_FILE = 'resources.json' # NOVO ARQUIVO DE RECURSOS

# Garante que os arquivos existam e inicializa RESOURCES_FILE
def initialize_files():
    """Garante que os arquivos necessários existam e os inicializa se for a primeira vez."""
    for filename in [KNOWLEDGE_FILE, LOGS_FILE, FEEDBACK_FILE]:
        if not os.path.exists(filename):
            with open(filename, 'w', encoding='utf-8') as f:
                if filename == KNOWLEDGE_FILE:
                    f.write("Você é a Jady, assistente de apoio do Quebre o Ciclo. Sempre responda em português. Seu objetivo é fornecer informações sobre direitos, leis (como Lei Maria da Penha) e locais de ajuda. Mantenha o tom de voz acolhedor, empático e informativo. Sempre reforce para a usuária buscar ajuda profissional ou ligar 190 em caso de emergência. Nunca se apresente como terapeuta ou substituta de apoio legal/policial.")
                elif filename == LOGS_FILE:
                    f.write(f"--- Logs Iniciados em {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ---\n")
                elif filename == FEEDBACK_FILE:
                    f.write(f"--- Feedback Iniciado em {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ---\n")
    
    # Inicializa o arquivo JSON de Recursos
    if not os.path.exists(RESOURCES_FILE):
        default_resources = {
            "title": "Contatos e Fontes de Apoio (Editável no Admin)",
            "description": "Estes são contatos importantes que você pode usar para apoio imediato.",
            "contacts": [
                {"name": "Emergência (Polícia)", "value": "190"},
                {"name": "Central de Atendimento à Mulher", "value": "180"},
                {"name": "Conselho Tutelar", "value": "Disque 100"},
                {"name": "Centro de Referência de Assistência Social (CRAS)", "value": "Busque o endereço mais próximo no Google"}
            ]
        }
        try:
            with open(RESOURCES_FILE, 'w', encoding='utf-8') as f:
                json.dump(default_resources, f, ensure_ascii=False, indent=4)
        except IOError as e:
            print(f"Erro ao inicializar o arquivo de recursos: {e}")

initialize_files() # Chama a função de inicialização na startup

# --- Funções Auxiliares de Arquivo ---
def get_system_instruction():
    """Lê e retorna a instrução do sistema do arquivo."""
    try:
        with open(KNOWLEDGE_FILE, 'r', encoding='utf-8') as f:
            return f.read().strip()
    except FileNotFoundError:
        return "Você é a Jady, assistente de apoio do Quebre o Ciclo."

def get_resources():
    """Lê e retorna o conteúdo do resources.json."""
    try:
        with open(RESOURCES_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        # Retorna estrutura vazia em caso de erro de leitura
        return {"title": "Recursos Indisponíveis", "description": "Erro ao carregar recursos.", "contacts": []}

def log_conversation(user_message, ai_response):
    """Registra a conversa (usuário e IA) no arquivo de logs."""
    timestamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    log_entry = (
        f"[{timestamp}]\n"
        f"  Usuário: {user_message}\n"
        f"  Jady: {ai_response}\n"
        f"----------------------------------------\n"
    )
    try:
        with open(LOGS_FILE, 'a', encoding='utf-8') as f:
            f.write(log_entry)
    except IOError as e:
        print(f"Erro ao escrever no arquivo de logs: {e}")

def log_feedback(feedback_type, user_prompt, ai_response):
    """Registra o feedback do usuário no arquivo."""
    timestamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    feedback_entry = (
        f"[{timestamp}] Tipo: {feedback_type.upper()}\n"
        f"  Prompt: {user_prompt}\n"
        f"  Resposta da Jady: {ai_response}\n"
        f"----------------------------------------\n"
    )
    try:
        with open(FEEDBACK_FILE, 'a', encoding='utf-8') as f:
            f.write(feedback_entry)
    except IOError as e:
        print(f"Erro ao escrever no arquivo de feedback: {e}")

# --- Funções do Gemini ---
def start_chat():
    """Inicializa um novo chat com a instrução do sistema."""
    # NOVO: Inclui os recursos no system_instruction para que a Jady possa usá-los
    resources = get_resources()
    resources_text = "\n\n--- RECURSOS DE APOIO ---\n"
    for contact in resources.get('contacts', []):
        resources_text += f"- {contact['name']}: {contact['value']}\n"
        
    system_instruction = get_system_instruction() + resources_text
    
    return client.chats.create(
        model='gemini-2.5-flash',
        config=types.GenerateContentConfig(
            system_instruction=system_instruction
        )
    )

# --- Rotas do Chat e Feedback (Mantidas) ---
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat_endpoint():
    data = request.json
    user_message = data.get('message', '')
    history = data.get('history', [])
    
    # 1. Reconstroi o chat a partir do histórico
    chat = start_chat()
    for item in history:
        if item['role'] == 'model' and item['parts'][0]['text'].startswith("Olá! Eu sou a **Jady**"):
            continue
        chat.history.append(types.Content(**item))

    try:
        # 2. Envia a nova mensagem
        response = chat.send_message(user_message)
        ai_response = response.text
        
        # 3. LOGA A CONVERSA
        log_conversation(user_message, ai_response)
        
        last_user_prompt = user_message 
        
        return jsonify({
            'response': ai_response,
            'user_prompt': last_user_prompt,
            'ai_response_text': ai_response 
        })
    
    except Exception as e:
        print(f"Erro ao comunicar com o Gemini: {e}")
        return jsonify({'response': "Desculpe, houve um erro técnico ao comunicar com a assistente. Por favor, tente novamente ou ligue 190."}), 500

@app.route('/feedback', methods=['POST'])
def receive_feedback():
    data = request.json
    feedback_type = data.get('type') 
    user_prompt = data.get('user_prompt')
    ai_response_text = data.get('ai_response_text')
    
    if feedback_type and user_prompt and ai_response_text:
        log_feedback(feedback_type, user_prompt, ai_response_text)
        return jsonify({'status': 'success', 'message': f'Feedback {feedback_type} registrado.'})
    
    return jsonify({'status': 'error', 'message': 'Dados de feedback inválidos.'}), 400


# --- Rotas Admin (Atualizadas para Recursos) ---
@app.route('/admin', methods=['GET', 'POST'])
def admin_login():
    if 'logged_in' in session:
        return redirect(url_for('admin_painel'))

    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            session['logged_in'] = True
            return redirect(url_for('admin_painel'))
        else:
            return render_template('admin_login.html', error="Credenciais inválidas.")
            
    return render_template('admin_login.html')

@app.route('/admin/painel', methods=['GET', 'POST'])
def admin_painel():
    if 'logged_in' not in session:
        return redirect(url_for('admin_login'))

    system_instruction = get_system_instruction()
    resources_content = json.dumps(get_resources(), ensure_ascii=False, indent=4) # Carrega recursos como string JSON
    message = None
    
    if request.method == 'POST':
        if 'knowledge' in request.form:
            # 1. Processa Edição de Conhecimento
            new_instruction = request.form['knowledge']
            try:
                with open(KNOWLEDGE_FILE, 'w', encoding='utf-8') as f:
                    f.write(new_instruction)
                system_instruction = new_instruction 
                message = "Instrução da Jady (knowledge.txt) atualizada com sucesso!"
            except IOError:
                message = "Erro ao salvar o arquivo knowledge.txt."
        
        if 'resources' in request.form:
            # NOVO: 2. Processa Edição de Recursos JSON
            new_resources_content = request.form['resources']
            try:
                # Tenta carregar para validar se é um JSON válido
                json.loads(new_resources_content) 
                with open(RESOURCES_FILE, 'w', encoding='utf-8') as f:
                    f.write(new_resources_content)
                resources_content = new_resources_content # Atualiza a variável para o template
                message = "Fontes de Apoio (resources.json) atualizadas com sucesso!"
            except json.JSONDecodeError:
                message = "ERRO: O conteúdo enviado para Fontes de Apoio não é um JSON válido. Por favor, verifique a sintaxe."
            except IOError:
                message = "Erro ao salvar o arquivo resources.json."
        
        # Lógica de reset (logs e feedback)
        if 'reset_logs' in request.form:
            # 3. Processa Reset de Logs
            try:
                with open(LOGS_FILE, 'w', encoding='utf-8') as f:
                    f.write(f"--- Logs Resetados em {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ---\n")
                message = "Logs de conversa resetados com sucesso!"
            except IOError:
                message = "Erro ao resetar o arquivo de logs."
        
        if 'reset_feedback' in request.form: 
            # 4. Processa Reset de Feedback
            try:
                with open(FEEDBACK_FILE, 'w', encoding='utf-8') as f:
                    f.write(f"--- Feedback Resetado em {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ---\n")
                message = "Logs de feedback resetados com sucesso!"
            except IOError:
                message = "Erro ao resetar o arquivo de feedback."
                
    # Lê os logs e feedback para exibição
    try:
        with open(LOGS_FILE, 'r', encoding='utf-8') as f:
            logs_content = f.read()
    except FileNotFoundError:
        logs_content = "Arquivo de logs não encontrado."

    try:
        with open(FEEDBACK_FILE, 'r', encoding='utf-8') as f:
            feedback_content = f.read()
    except FileNotFoundError:
        feedback_content = "Arquivo de feedback não encontrado."

    return render_template(
        'admin_painel.html', 
        system_instruction=system_instruction, 
        resources_content=resources_content, # Passa o JSON dos recursos
        logs_content=logs_content, 
        feedback_content=feedback_content,
        message=message
    )


@app.route('/admin/logout')
def admin_logout():
    session.pop('logged_in', None)
    return redirect(url_for('admin_login'))

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=os.environ.get('PORT', 5000), debug=True)