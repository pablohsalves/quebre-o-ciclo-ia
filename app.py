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
# A chave secreta é ESSENCIAL para a segurança das sessões do Flask.
# Em produção (Render), você DEVE definir SECRET_KEY nas variáveis de ambiente.
SECRET_KEY = os.getenv("SECRET_KEY", "SUA_CHAVE_SECRETA_MUITO_FORTE_AQUI")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "adminjady")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "quebreociclo123") 
# ^^^^^^ MUDAR CREDENCIAIS ACIMA ANTES DE FAZER DEPLOY EM PRODUÇÃO! ^^^^^^

print("--- STATUS DO SERVIDOR ---")
if API_KEY:
    print("✅ Chave de API Gemini carregada.")
else:
    print("❌ AVISO CRÍTICO: GEMINI_API_KEY NÃO está carregada. O chat falhará!")
print(f"🔑 Chave Secreta configurada: {SECRET_KEY[:5]}...")
print("--------------------------")


# --- Configuração do Flask ---
app = Flask(__name__)
app.secret_key = SECRET_KEY # Configura a chave secreta para as sessões

# --- Configuração da Assistente (System Instruction) ---
SYSTEM_INSTRUCTION = (
    "Você é a Jady, uma assistente de IA do projeto 'Quebre o Ciclo'. "
    "Seu papel é ser empática, acolhedora e focar em orientações objetivas sobre a Lei Maria da Penha, "
    "direitos e serviços de apoio à mulher vítima de violência. Use tom suave, mas assertivo.\n\n"
    "DIRETRIZES ESSENCIAIS:\n"
    "1. **Emergência:** SEMPRE priorize e reforce os contatos: **190 (Polícia Militar)** para risco imediato e **180 (Central de Atendimento à Mulher)** para denúncias e informações. NUNCA hesite em sugerir ligar para 190.\n"
    "2. **Lei Maria da Penha:** Confirme que é a principal ferramenta de proteção (Lei nº 11.340/2006).\n"
    "3. **Localização (CRAS/Apoio):** Se a usuária pedir ajuda localizada (ex: CRAS, delegacia), oriente a pesquisar no Google Maps 'CRAS [Nome da Cidade]' ou 'Delegacia da Mulher [Nome da Cidade]', pois você não tem acesso em tempo real aos dados municipais. REFORCE que é o melhor caminho.\n"
    "4. **Formato da Resposta:** Use Markdown para que o texto fique bem formatado no chat web (ex: **negrito** e *listas*).\n"
    "5. **NÃO Julgue.** Mantenha a confidencialidade e o acolhimento."
)

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
            system_instruction=SYSTEM_INSTRUCTION
        )
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=contents, 
            config=config
        )

        return jsonify({"response": response.text})

    except APIError as e:
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


@app.route("/admin-painel")
def admin_painel():
    """Área administrativa protegida. Requer login."""
    if not session.get('logged_in'):
        # Se não estiver logado, redireciona para a página de login
        return redirect(url_for('admin_login')) 
        
    # Se estiver logado, exibe o painel
    return render_template("admin_painel.html")


@app.route("/admin-logout")
def admin_logout():
    """Termina a sessão do usuário."""
    session.pop('logged_in', None)
    return redirect(url_for('index')) # Volta para a página principal


if __name__ == "__main__":
    print("Servidor Flask inicializado. Acesse: http://127.0.0.1:5000/")
    # O debug deve ser FALSE em produção!
    app.run(debug=True)