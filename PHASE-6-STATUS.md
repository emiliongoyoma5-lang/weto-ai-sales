# Weto AI de Vendas — Fase 6

## Follow-up automático e recuperação de vendas

Implementado:

- scheduler interno configurável por `FOLLOW_UP_INTERVAL_SECONDS`;
- execução automática e endpoint manual `POST /api/v1/follow-ups/run`;
- claim idempotente por oportunidade para evitar envio duplicado entre instâncias;
- lease de processamento de 5 minutos;
- máximo de 3 tentativas por oportunidade;
- espaçamento após tentativas: 24h e depois 72h;
- encerramento como `LOST` após a terceira tentativa sem conversão;
- não envia follow-up quando atendimento humano está ativo;
- não envia para conversa fechada ou canal ainda não suportado;
- envio pelo adaptador WhatsApp existente;
- cada follow-up fica registrado como mensagem AI com metadados de auditoria;
- falhas de envio entram em retry de 15 minutos;
- ausência de telefone ou conversa AI ativa é adiada, não enviada;
- pedidos pendentes recebem mensagem de recuperação específica;
- a mensagem usa contexto do cliente, mas nunca usa memória como fonte de preço/stock.

## Regras comerciais

- confirmação de venda continua sendo responsabilidade do motor de pedidos;
- follow-up não confirma pedido automaticamente;
- follow-up não altera preço ou estoque;
- venda confirmada/cancelamento continuam fechando somente oportunidades relacionadas aos produtos envolvidos.

## Validação

Revisão estrutural e de integração concluída. O ambiente desta execução não possui `node_modules`, portanto `tsc`, Prisma e runtime NestJS não foram declarados como executados.
