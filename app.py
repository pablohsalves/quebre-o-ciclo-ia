import os
from flask import Flask, render_template, request, jsonify
from google import genai
from google.genai import types
from google.genai.errors import APIError
from dotenv import load_dotenv

# Carrega variáveis de ambiente do arquivo .env (para testes locais)
load_dotenv() 

# --- Variável de Debugging e Status da Chave ---
API_KEY = os.getenv("GEMINI_API_KEY")

# Esta checagem de segurança (DEBUG) é crucial
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
    "Você é a Força Feminina, uma assistente de IA do projeto 'Quebre o Ciclo'. "
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
    """Rota principal que renderiza a página HTML do chat."""
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    """
    Rota da API que recebe a mensagem do frontend, processa com Gemini e retorna a resposta.
    """
    if not API_KEY:
        return jsonify({"response": "Desculpe, a assistente não está operacional no momento. O servidor está sem a chave da API."}), 500
        
    data = request.get_json()
    user_message = data.get("message")

    if not user_message:
        return jsonify({"response": "Mensagem vazia."}), 400

    try:
        client = genai.Client()
        
        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION
        )
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=user_message,
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

if __name__ == "__main__":
    # Comando para rodar o servidor localmente
    print("Servidor Flask inicializado. Acesse: http://127.0.0.1:5000/")
    app.run(debug=True)