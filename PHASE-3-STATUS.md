# Weto AI Sales — Fase 3

## Estado: CONCLUÍDA ESTRUTURALMENTE

### Entregue
- Adapter de WhatsApp isolado do motor de vendas.
- Webhook GET para verificação.
- Webhook POST para receber mensagens.
- Mapeamento de telefone do WhatsApp para Channel/tenant.
- Normalização de texto, imagem, áudio e documento.
- Idempotência preservada pelo externalMessageId.
- Encaminhamento automático da mensagem para o motor da Fase 2.
- Envio automático da resposta da IA de volta ao WhatsApp.
- Credenciais do canal cifradas com AES-256-GCM.
- Versão da Graph API configurável por ambiente.

### Fluxo
WhatsApp -> Webhook -> Channel -> Conversation -> AI Sales -> Message AI -> WhatsApp

### Configuração
1. Criar um Channel com type=WHATSAPP e externalId=phone_number_id.
2. Configurar o canal em POST /api/v1/channels/whatsapp/configure.
3. Definir APP_ENCRYPTION_KEY e WHATSAPP_GRAPH_VERSION.
4. Configurar o callback do fornecedor para GET/POST /api/v1/webhooks/whatsapp.

### Validação pendente de ambiente
O ambiente desta sessão não conseguiu concluir instalação das dependências npm anteriormente. Portanto a execução real do NestJS/Prisma e o teste contra uma conta WhatsApp real precisam ser feitos num ambiente com dependências e credenciais disponíveis.
