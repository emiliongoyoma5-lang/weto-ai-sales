# Weto AI de Vendas — Fase 1

Núcleo inicial reconstruído do zero para o sistema de IA de Vendas do Universo Weto.

## Objetivo da fase

Estabelecer a base transacional do atendimento sem depender de um modelo de IA:

- multiempresa (`Tenant`);
- canais independentes (`Channel`);
- clientes (`Customer`);
- conversas (`Conversation`);
- mensagens recebidas (`Message`);
- catálogo/estoque mínimo para as próximas fases (`Product`, `Inventory`);
- idempotência de mensagens por identificador externo;
- separação clara entre dados comerciais e camada de IA.

## Endpoints da fase

- `GET /api/v1/health`
- `POST /api/v1/tenants`
- `GET /api/v1/tenants/:id`
- `POST /api/v1/channels`
- `POST /api/v1/conversations/messages/incoming`

## Próxima fase

Somente depois desta base estar validada: motor de atendimento que interpreta uma mensagem e consulta dados reais de produto/preço/stock antes de responder.
