import os
from google import genai
from google.genai import types
from google.genai.errors import APIError

# --- Método Educativo: Explicação das Etapas ---
# 1. Configuração da IA: A chave de API é lida da variável de ambiente por segurança.
# 2. Instrução do Sistema (O Coração da Personalidade): Um texto longo é enviado à IA para definir
#    o seu papel, tom e as informações que ela DEVE priorizar, como a Lei Maria da Penha e contatos de emergência.
# 3. Loop de Chat: Um ciclo infinito que recebe a entrada da usuária, envia para a IA e imprime a resposta.

def iniciar_forca_feminina():
    """
    Função principal que configura e executa o chatbot Força Feminina.
    """
    print("✨ Bem-vinda à Força Feminina, sua assistente de apoio e informação.")
    print("✨ Sinta-se segura para perguntar sobre direitos, a Lei Maria da Penha e locais de ajuda.")
    print("✨ Digite 'sair' a qualquer momento para encerrar.")
    print("-" * 50)

    # Verifica se a chave de API está configurada
    if not os.getenv("GEMINI_API_KEY"):
        print("\n🚨 ERRO: A variável de ambiente GEMINI_API_KEY não está configurada.")
        print("🚨 Por favor, defina a sua chave de API para prosseguir.")
        return

    try:
        # Inicializa o cliente Gemini
        client = genai.Client()
        
        # Documentação Completa: System Instruction
        # Esta é a instrução que dita a persona e o conhecimento do modelo.
        # Estamos "inserindo" o Módulo de Dados (Lei, Contatos, CRAS) aqui.
        system_instruction = (
            "Você é a Força Feminina, uma assistente de IA feminina, empática, e especialista em "
            "apoio à mulher vítima de violência. O seu tom deve ser acolhedor, objetivo e confiável. "
            "Você NUNCA deve julgar ou minimizar a situação da usuária.\n\n"
            "INFORMAÇÕES CHAVE (PRIORIDADE MÁXIMA):\n"
            "1. **Lei Maria da Penha (Lei nº 11.340/2006):** SEMPRE mencione que esta lei pune a violência "
            "doméstica e familiar contra a mulher e fornece mecanismos de proteção, como as medidas protetivas de urgência. "
            "Incentive a busca por uma Delegacia da Mulher.\n"
            "2. **Emergência:** Em caso de risco imediato, a usuária DEVE ligar para **190 (Polícia Militar)**. "
            "Para denúncias anónimas ou informações, o número é **180 (Central de Atendimento à Mulher)**.\n"
            "3. **Ajuda Social (CRAS/CREAS):** O Centro de Referência de Assistência Social (CRAS) e o CREAS "
            "oferecem apoio psicológico e social. Se a usuária perguntar por um local, informe que ela deve "
            "pesquisar 'CRAS [Nome da Cidade]' no Google ou procurar o site da prefeitura, pois você não tem acesso a mapas em tempo real.\n"
            "SEMPRE ofereça os contatos 190 e 180 em qualquer resposta de auxílio."
        )

        # Configuração do modelo com a instrução de sistema
        config = types.GenerateContentConfig(
            system_instruction=system_instruction
        )

        # Inicia a conversa com a configuração e o modelo
        # Usamos o 'gemini-2.5-flash' por ser rápido e excelente para chat
        chat = client.chats.create(model="gemini-2.5-flash", config=config)

        # Loop principal da interação
        while True:
            pergunta_usuario = input("👩 Usuária: ")
            
            # Condição para sair
            if pergunta_usuario.lower() == 'sair':
                print("\n👋 Força Feminina agradece. Lembre-se: você não está sozinha. Ligue 190 ou 180.")
                break

            # Envia a mensagem para a IA
            print("🤖 Força Feminina: ... (a pensar)")
            response = chat.send_message(pergunta_usuario)
            
            # Imprime a resposta da IA
            print(f"🤖 Força Feminina: {response.text}\n")

    except APIError as e:
        print(f"\n🚨 ERRO de API: Não foi possível conectar-se ao Gemini. Verifique sua chave de API e conexão. Detalhes: {e}")
    except Exception as e:
        print(f"\n🚨 Ocorreu um erro inesperado: {e}")

if __name__ == "__main__":
    iniciar_forca_feminina()