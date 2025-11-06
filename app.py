import os
import datetime
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
LOGS_FILE = 'logs.txt' # NOVO ARQUIVO DE LOGS

# Garante que os arquivos existam
for filename in [KNOWLEDGE_FILE, LOGS_FILE]:
    if not os.path.exists(filename):
        with open(filename, 'w', encoding='utf-8') as f:
            # Inicializa o knowledge.txt se for a primeira vez
            if filename == KNOWLEDGE_FILE:
                f.write("Você é a Jady, assistente de apoio do Quebre o Ciclo. Sempre responda em português. Seu objetivo é fornecer informações sobre direitos, leis (como Lei Maria da Penha) e locais de ajuda. Mantenha o tom de voz acolhedor, empático e informativo. Sempre reforce para a usuária buscar ajuda profissional ou ligar 190 em caso de emergência. Nunca se apresente como terapeuta ou substituta de apoio legal/policial.")
            elif filename == LOGS_FILE:
                f.write(f"--- Logs Iniciados em {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ---\n")

# --- Funções do Gemini ---
def get_system_instruction():
    """Lê e retorna a instrução do sistema do arquivo."""
    try:
        with open(KNOWLEDGE_FILE, 'r', encoding='utf-8') as f:
            return f.read().strip()
    except FileNotFoundError:
        return "Você é a Jady, assistente de apoio do Quebre o Ciclo."

def start_chat():
    """Inicializa um novo chat com a instrução do sistema."""
    return client.chats.create(
        model='gemini-2.5-flash',
        config=types.GenerateContentConfig(
            system_instruction=get_system_instruction()
        )
    )

# --- NOVO: Função de Logging ---
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

# --- Rotas do Chat ---
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
        # Pula a mensagem inicial de boas-vindas para evitar prompt duplo, mas a mantém no histórico
        if item['role'] == 'model' and item['parts'][0]['text'].startswith("Olá! Eu sou a **Jady**"):
            continue
        # Adiciona mensagens passadas
        chat.history.append(types.Content(**item))

    try:
        # 2. Envia a nova mensagem
        response = chat.send_message(user_message)
        ai_response = response.text
        
        # 3. LOGA A CONVERSA
        log_conversation(user_message, ai_response)
        
        return jsonify({'response': ai_response})
    
    except Exception as e:
        print(f"Erro ao comunicar com o Gemini: {e}")
        # Retorno de erro mais acolhedor
        return jsonify({'response': "Desculpe, houve um erro técnico ao comunicar com a assistente. Por favor, tente novamente ou ligue 190."}), 500

# --- Rotas Admin ---
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
    message = None
    
    if request.method == 'POST':
        if 'knowledge' in request.form:
            # 1. Processa Edição de Conhecimento
            new_instruction = request.form['knowledge']
            try:
                with open(KNOWLEDGE_FILE, 'w', encoding='utf-8') as f:
                    f.write(new_instruction)
                system_instruction = new_instruction # Atualiza a variável para o template
                message = "Instrução da Jady (knowledge.txt) atualizada com sucesso!"
            except IOError:
                message = "Erro ao salvar o arquivo knowledge.txt."
        
        if 'reset_logs' in request.form:
            # 2. Processa Reset de Logs
            try:
                with open(LOGS_FILE, 'w', encoding='utf-8') as f:
                    f.write(f"--- Logs Resetados em {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ---\n")
                message = "Logs de conversa resetados com sucesso!"
            except IOError:
                message = "Erro ao resetar o arquivo de logs."
                
    # Lê os logs para exibição
    try:
        with open(LOGS_FILE, 'r', encoding='utf-8') as f:
            logs_content = f.read()
    except FileNotFoundError:
        logs_content = "Arquivo de logs não encontrado."

    return render_template(
        'admin_painel.html', 
        system_instruction=system_instruction, 
        logs_content=logs_content, # Passa o conteúdo dos logs
        message=message
    )


@app.route('/admin/logout')
def admin_logout():
    session.pop('logged_in', None)
    return redirect(url_for('admin_login'))

if __name__ == '__main__':
    # Use 0.0.0.0 para que o servidor seja acessível externamente (necessário para Render)
    app.run(host='0.0.0.0', port=os.environ.get('PORT', 5000), debug=True)