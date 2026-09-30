# Weto AI Sales — Fase 4

## Estado
Concluída estruturalmente.

## O que foi implementado
- Camada de provedor de IA desacoplada do motor comercial.
- Integração com OpenAI Responses API via HTTP, sem acoplar o domínio ao SDK.
- Conversação usando histórico recente da conversa.
- Atendimento em linguagem natural em português.
- Function calling com ferramentas controladas pelo backend:
  - search_products
  - get_product_info
  - create_pending_order
  - confirm_pending_order
  - cancel_pending_order
  - handoff_to_human
- Preço e estoque continuam vindo exclusivamente do PostgreSQL.
- Criação de pedido continua pendente de confirmação.
- Confirmação continua com decremento atómico de estoque.
- Pedido de atendimento humano muda a conversa para HUMAN_HANDLING.
- Falha/ausência da API de IA faz fallback para o motor determinístico da Fase 2.
- Limite de 4 ciclos de chamadas de ferramentas por mensagem.
- Validação básica dos argumentos das ferramentas antes de executar operações comerciais.

## Limitação de validação
Não foi possível concluir build/runtime real neste ambiente devido aos timeouts anteriores de instalação/execução do ecossistema npm. A integração foi revisada estaticamente.

## Configuração
Definir no `.env`:
- OPENAI_API_KEY
- OPENAI_MODEL (opcional; padrão: gpt-5.6-luna)
