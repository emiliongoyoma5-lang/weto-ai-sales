# Weto AI Sales — Fase 5

## Estado
Concluída estruturalmente.

## Objetivo
Adicionar memória de relacionamento e base de recuperação de oportunidades sem transformar memória em fonte de verdade comercial.

## Implementado
- CustomerMemory com tipos PREFERENCE, PROFILE, NEED, CONTEXT e COMMERCIAL.
- Expiração opcional de memória.
- Contexto do cliente com memórias, oportunidades abertas e últimos pedidos.
- Ferramentas de IA para consultar contexto e guardar preferências/informações úteis.
- SalesOpportunity para oportunidades abertas, ganhas, perdidas ou dispensadas.
- Interesse identificado em produto cria/atualiza oportunidade com follow-up.
- Pedido pendente cria follow-up de curto prazo.
- Venda confirmada fecha oportunidades abertas como WON.
- Cancelamento fecha oportunidades abertas como LOST.
- Atividade do cliente atualiza lastActivityAt das oportunidades abertas.
- Endpoint interno para consultar contexto do cliente.
- Endpoint interno para consultar follow-ups vencidos.
- Memória nunca é usada para informar preço, estoque ou condição comercial.

## Endpoints
- GET /api/v1/memory/customers/:customerId/context?tenantId=...
- GET /api/v1/memory/follow-ups?tenantId=...&limit=50

## Validação
Revisão estrutural concluída. O ambiente de entrega não possui node_modules, portanto Prisma/TypeScript não foram executados localmente.
