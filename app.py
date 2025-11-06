import os
from flask import Flask, render_template, request, jsonify
from google import genai
from google.genai import types
from google.genai.errors import APIError
from dotenv import load_dotenv

# Carrega variáveis de ambiente
load_dotenv() 

# --- Variável de Debugging e Status da Chave ---
API_KEY = os.getenv("GEMINI_API_KEY")

print("--- STATUS DA CHAVE DE API ---")
if API_KEY:
    print("✅ Chave de API Gemini carregada no ambiente.")
else:
    print("❌ AVISO CRÍTICO: GEMINI_API_KEY NÃO está carregada. O chat falhará!")
print("------------------------------")

# --- Configuração do Flask ---
app = Flask(__name__)

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
    chat_history = data.get("history", []) # Recebe o histórico do JS
    
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

@app.route("/admin-painel-jady") # Rota secreta de admin
def admin_login():
    """
    Página de Login para a área administrativa.
    """
    return "<h1>Área Administrativa Jady</h1><p>Em desenvolvimento: Futuramente, aqui teremos login e ferramentas para editar o conhecimento da assistente.</p>"


if __name__ == "__main__":
    print("Servidor Flask inicializado. Acesse: http://127.0.0.1:5000/")
    app.run(debug=True)