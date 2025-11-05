# Módulo de Dados: Respostas Estáticas e Chaves
# Este dicionário simula o conhecimento base da IA antes da integração com o Gemini.
DADOS_RESPOSTAS = {
    "LEI": "A Lei Maria da Penha (Lei nº 11.340/2006) é a sua principal aliada! Ela garante as Medidas Protetivas de Urgência e pune a violência. Busque a Delegacia da Mulher ou o Juizado de Violência Doméstica.",
    "EMERGENCIA": "🚨 RISCO IMEDIATO? Ligue **190 (Polícia Militar)**. Para denúncias anónimas ou informações, o número é **180 (Central de Atendimento à Mulher)**. Eles podem ajudar agora!",
    "CRAS": "O Centro de Referência de Assistência Social (CRAS) e o CREAS oferecem apoio social, psicológico e orientação. Como não tenho acesso a mapas, por favor, pesquise 'CRAS/CREAS [Sua Cidade]' no Google ou no site da Prefeitura.",
    "APOIO": "Você não está sozinha. Se precisar conversar, procure um Centro de Referência de Apoio à Mulher. Se a sua necessidade é de orientação legal ou psicológica, consulte a Defensoria Pública da sua região.",
    "SAIR": "👋 Agradeço por ter conversado comigo. Lembre-se: 'Quebre o Ciclo'. Os números de emergência são 190 e 180."
}

# --- Funcionalidade 5b, item ii: Avaliação de Risco Discreta ---
def avaliacao_de_risco():
    """
    Função para fazer uma avaliação de risco inicial e sugerir a ação mais segura.
    """
    print("\n--- ❗ AVALIAÇÃO DE RISCO INICIAL ❗ ---")
    print("Responda com 'sim' ou 'não'. Suas respostas são sigilosas.\n")
    
    # Pergunta 1: Risco Imediato
    r1 = input("Sente que a sua integridade física está em risco AGORA? (sim/não): ").lower()
    
    if r1 == 'sim':
        print("\n🆘 **AÇÃO IMEDIATA NECESSÁRIA!** Ligue **190** e saia para um local seguro (vizinho, comércio, local público).")
        return
    
    # Pergunta 2: Cerceamento de Liberdade
    r2 = input("O agressor controla o seu dinheiro, te isola de amigos/família, ou monitora as suas comunicações? (sim/não): ").lower()
    
    # Pergunta 3: Histórico de Violência Física
    r3 = input("Houve agressão física ou ameaça grave nos últimos tempos? (sim/não): ").lower()
    
    # Análise das respostas
    if r2 == 'sim' or r3 == 'sim':
        print("\n⚠️ **ALERTA DE RISCO ELEVADO:** Sua situação requer atenção e um plano de segurança.")
        print("Ligue **180** para obter um plano de segurança e orientação jurídica. Procure também o CRAS/CREAS mais próximo.")
    else:
        print("\n✨ Entendido. Mesmo sem risco imediato, a violência psicológica ou patrimonial precisa de atenção.")
        print("Recomendo usar o comando 'APOIO' para buscar recursos sociais e educacionais.")
        
    print("-" * 50)


# --- Módulo Principal: Gerencia o Layout e o Loop de Chat ---
def iniciar_quebre_o_ciclo_mvp():
    """
    Inicia o chatbot MVP com layout de console e loop de interação.
    """
    
    # Layout: Saudação Inicial
    print("=" * 50)
    print("     ✨ BEM-VINDA AO QUEBRE O CICLO ✨")
    print("     Sua assistente de apoio e informação.")
    print("=" * 50)
    print("Comandos rápidos disponíveis:")
    print("  * 'RISCO': Inicia a Avaliação de Risco Imediato.")
    print("  * 'LEI': Informações sobre a Lei Maria da Penha.")
    print("  * 'EMERGENCIA': Contatos 190 e 180.")
    print("  * 'APOIO': Recursos sociais (CRAS, ONGs).")
    print("  * 'SAIR': Encerra o programa.")
    print("-" * 50)

    while True:
        pergunta_usuario = input("👩 Usuária: ")
        entrada = pergunta_usuario.upper().strip()

        # Verifica comandos predefinidos
        if entrada == 'SAIR':
            print(f"\n🤖 Força Feminina: {DADOS_RESPOSTAS['SAIR']}")
            break
        
        elif entrada == 'RISCO':
            # Chama a função de avaliação de risco
            avaliacao_de_risco()
        
        elif entrada in DADOS_RESPOSTAS:
            # Responde com o dado estático
            print(f"\n🤖 Força Feminina: {DADOS_RESPOSTAS[entrada]}\n")
            
        else:
            # Simulação de resposta "inteligente" antes do Gemini
            # Funcionalidade 5b, item i (Orientação para denúncias)
            if "DENUNCIA" in entrada or "DENUNCIAR" in entrada:
                 print(f"\n🤖 Força Feminina: Para denúncia, ligue 180 (anónima) ou 190 (emergência). Lembre-se, a sua segurança é prioridade! {DADOS_RESPOSTAS['LEI']}\n")
            elif "ADVOGADO" in entrada or "JURIDICO" in entrada:
                 print(f"\n🤖 Força Feminina: Para apoio jurídico, a Defensoria Pública pode te ajudar gratuitamente. Você pode também ligar no 180. {DADOS_RESPOSTAS['LEI']}\n")
            else:
                # Resposta padrão para qualquer outra coisa
                print("\n🤖 Força Feminina: Não entendi a sua pergunta. Estou programada para responder sobre LEI, EMERGENCIA, CRAS e APOIO. Se for urgente, use 'RISCO' ou ligue **190/180**.\n")

if __name__ == "__main__":
    iniciar_quebre_o_ciclo_mvp()