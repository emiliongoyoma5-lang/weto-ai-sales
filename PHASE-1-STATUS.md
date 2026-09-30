# Fase 1 — Estado

## Entregue

- Novo projeto `weto-ai-sales` separado da implementação anterior.
- NestJS + Prisma + PostgreSQL como base.
- Modelo multiempresa (`Tenant`).
- Canais independentes (`Channel`).
- Clientes (`Customer`).
- Conversas (`Conversation`).
- Mensagens com texto, imagem, áudio e documento (`Message`).
- Catálogo/stock mínimo para as fases seguintes (`Product`, `Inventory`).
- Endpoint de entrada de mensagens: `POST /api/v1/conversations/messages/incoming`.
- Idempotência por identificador externo dentro da conversa.
- Validação global de payloads.
- Health check.

## Decisão de arquitetura

A IA ainda não tem acesso direto ao transporte nem altera dados comerciais por conta própria. A próxima camada será construída sobre este núcleo e consultará dados estruturados antes de produzir respostas.

## Validação

A verificação estrutural local passou (`STRUCTURE_OK`).

A instalação de dependências npm e, consequentemente, `prisma generate`, `prisma validate`, build NestJS e Jest não puderam ser executados neste ambiente porque `npm install` excedeu o limite de execução disponível.

Não é apresentado como build validado até essa execução ser feita num ambiente com acesso ao registry/cache npm.
