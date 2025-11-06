import os
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from google import genai
from google.genai import types
from google.genai.errors import APIError
from dotenv import load_dotenv

# Carrega variáveis de ambiente
load_dotenv() 

# --- Variável de Debugging e Status da Chave ---
API_KEY = os.getenv("GEMINI_API_KEY")

# --- Configuração de Segurança e Admin ---
SECRET_KEY = os.getenv("SECRET_KEY", "SUA_CHAVE_SECRETA_MUITO_FORTE_AQUI")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "adminjady")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "quebreociclo123") 

# --- Configuração de I/O de Conhecimento ---
KNOWLEDGE_FILE = "knowledge.txt"

def load_system_instruction():
    """Carrega a instrução do sistema a partir do arquivo."""
    try:
        with open(KNOWLEDGE_FILE, 'r', encoding='utf-8') as f:
            return f.read().strip()
    except FileNotFoundError:
        print(f"⚠️ Arquivo {KNOWLEDGE_FILE} não encontrado. Criando arquivo padrão.")
        # Instrução padrão se o arquivo não existir
        default_instruction = (
            "Você é a Jady, uma assistente de IA do projeto 'Quebre o Ciclo'. Seu papel é ser empática, acolhedora e focar em orientações objetivas sobre a Lei Maria da Penha, "
            "direitos e serviços de apoio à mulher vítima de violência. Use tom suave, mas assertivo.\n\n"
            "DIRETRIZES ESSENCIAIS:\n1. EMERGÊNCIA: Ligue 190. 2. Ajuda: Ligue 180."
        )
        save_system_instruction(default_instruction)
        return default_instruction

def save_system_instruction(new_instruction):
    """Salva a nova instrução no arquivo."""
    try:
        with open(KNOWLEDGE_FILE, 'w', encoding='utf-8') as f:
            f.write(new_instruction.strip())
        return True
    except Exception as e:
        print(f"🚨 ERRO ao salvar instrução: {e}")
        return False

# CARREGA A INSTRUÇÃO AO INICIAR O APP
SYSTEM_INSTRUCTION = load_system_instruction()


print("--- STATUS DO SERVIDOR ---")
if API_KEY:
    print("✅ Chave de API Gemini carregada.")
else:
    print("❌ AVISO CRÍTICO: GEMINI_API_KEY NÃO está carregada. O chat falhará!")
print("--------------------------")


# --- Configuração do Flask ---
app = Flask(__name__)
app.secret_key = SECRET_KEY # Configura a chave secreta para as sessões


@app.route("/")
def index():
    """Rota principal do chat."""
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    """
    Rota da API que recebe a mensagem ATUAL E O HISTÓRICO, processa com Gemini e retorna a resposta.
    """
    if not API_KEY:
        return jsonify({"response": "Desculpe, a assistente não está operacional no momento. O servidor está sem a chave da API."}), 500
        
    data = request.get_json()
    user_message = data.get("message")
    chat_history = data.get("history", []) 
    
    if not user_message:
        return jsonify({"response": "Mensagem vazia."}), 400

    try:
        client = genai.Client()
        
        # Monta a lista de conteúdos: Histórico + Mensagem Atual
        contents = chat_history + [
            {"role": "user", "parts": [{"text": user_message}]}
        ]
        
        config = types.GenerateContentConfig(
            # Usa a variável global que é atualizada ao editar o painel
            system_instruction=SYSTEM_INSTRUCTION 
        )
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=contents, 
            config=config
        )

        return jsonify({"response": response.text})

    except APIError as e:
        # ... (tratamento de erros, permanece o mesmo) ...
        error_details = str(e)
        if "RESOURCE_EXHAUSTED" in error_details:
            user_friendly_message = "Desculpe, a assistente atingiu o limite de uso no momento. Por favor, tente novamente em alguns minutos. (Erro de cota 429)"
            status_code = 429
        else:
            user_friendly_message = "Desculpe, houve um erro ao comunicar com a assistente. Por favor, tente novamente ou ligue 180."
            status_code = 500

        print(f"🚨 Erro de API do Gemini: {error_details}")
        return jsonify({"response": user_friendly_message}), status_code
        
    except Exception as e:
        print(f"🚨 Erro interno inesperado: {e}")
        return jsonify({"response": "Ocorreu um erro inesperado no servidor."}), 500

# ------------------------------
# --- ROTAS DE ADMIN (PROTEGIDAS) ---
# ------------------------------

@app.route("/admin-login", methods=["GET", "POST"])
def admin_login():
    """Lida com o formulário de login e autenticação."""
    error = None
    
    if request.method == "POST":
        username = request.form["username"]
        password = request.form["password"]

        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            session['logged_in'] = True
            return redirect(url_for('admin_painel')) 
        else:
            error = "Credenciais inválidas. Tente novamente."

    return render_template("admin_login.html", error=error)


@app.route("/admin-painel", methods=["GET", "POST"])
def admin_painel():
    """Área administrativa protegida. Lida com a edição do conhecimento."""
    if not session.get('logged_in'):
        return redirect(url_for('admin_login')) 
    
    global SYSTEM_INSTRUCTION
    message = None

    if request.method == "POST":
        new_instruction = request.form.get("system_instruction_text")
        
        if new_instruction and save_system_instruction(new_instruction):
            SYSTEM_INSTRUCTION = new_instruction # Atualiza a variável em memória
            message = "✅ Conhecimento da Jady salvo e atualizado com sucesso!"
        else:
            message = "❌ Erro ao salvar o conhecimento. Verifique as permissões do servidor."
    
    # Garante que a instrução atual é exibida no formulário
    current_instruction = SYSTEM_INSTRUCTION 
    return render_template("admin_painel.html", 
                           current_instruction=current_instruction,
                           message=message)


@app.route("/admin-logout")
def admin_logout():
    """Termina a sessão do usuário."""
    session.pop('logged_in', None)
    return redirect(url_for('index'))


if __name__ == "__main__":
    print("Servidor Flask inicializado. Acesse: http://127.0.0.1:5000/")
    app.run(debug=True)