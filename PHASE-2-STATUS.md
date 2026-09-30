# Fase 2 — Estado

## Entregue

- Motor central de atendimento comercial.
- Classificação inicial de intenção: preço/disponibilidade, pedido, confirmação, cancelamento, atendimento humano e geral.
- Consulta de produto e stock exclusivamente nos dados estruturados.
- Resposta de preço e disponibilidade.
- Criação de pedido em `PENDING_CONFIRMATION`.
- Confirmação explícita antes de concluir a venda.
- Nova verificação de stock no momento da confirmação.
- Baixa de stock após confirmação.
- Cancelamento de pedido pendente.
- Transferência para atendimento humano e silêncio da IA após transferência.
- Endpoint para processar uma mensagem individual.
- Entrada de mensagem da Fase 1 já dispara o motor de atendimento.
- Endpoint mínimo para criação de produto/stock para testes e preparação das próximas fases.

## Regra principal

A IA não é fonte de verdade comercial. Preço e stock são sempre lidos do banco de dados.

## Limitação de validação

A estrutura dos ficheiros foi verificada localmente. O ambiente desta sessão não dispõe de uma instalação npm concluída, portanto `prisma generate`, `prisma validate`, build NestJS e testes de integração não foram executados aqui.

## Próxima fase

Persistência e processamento real dos canais externos (WhatsApp/Instagram/Website), incluindo envio da resposta gerada para o canal correto.
