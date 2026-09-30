import { Injectable, Logger } from '@nestjs/common';
import { MessageSender, MessageType, OrderStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AiProviderService } from './ai-provider.service';
import { MemoryService } from '../memory/memory.service';

type Intent = 'PRICE_OR_AVAILABILITY' | 'ORDER' | 'CONFIRM_ORDER' | 'CANCEL_ORDER' | 'HUMAN_HANDOFF' | 'GENERAL';

@Injectable()
export class AiSalesService {
  private readonly logger = new Logger(AiSalesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: AiProviderService,
    private readonly memory: MemoryService,
  ) {}

  async handleIncomingMessage(messageId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: { include: { customer: true, tenant: true } } },
    });
    if (!message || message.sender !== MessageSender.CUSTOMER) return null;
    if (message.conversation.status !== 'AI_HANDLING') return null;

    if (this.provider.isConfigured() && message.type === MessageType.TEXT && message.content?.trim()) {
      try {
        return await this.handleWithNaturalLanguage(message);
      } catch (error) {
        this.logger.error(`Natural AI failed; using deterministic fallback: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return this.handleWithDeterministicFallback(message);
  }

  private async handleWithNaturalLanguage(message: any) {
    const conversation = message.conversation;
    const history = await this.prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });
    history.reverse();

    const input = history.map((item) => ({
      role: item.sender === MessageSender.CUSTOMER ? 'user' : item.sender === MessageSender.AI ? 'assistant' : 'user',
      content: item.content || `[${item.type}]`,
    }));

    const tools = this.buildTools();
    const memoryContext = await this.memory.getContext(conversation.tenantId, conversation.customerId);
    const instructions = this.buildInstructions(conversation.tenant.name, conversation.tenant.currency, memoryContext);
    let turn = await this.provider.run(input, tools, instructions);

    for (let round = 0; round < 4 && turn.toolCalls.length; round++) {
      const outputs = [];
      for (const call of turn.toolCalls) {
        const result = await this.executeTool(call.name, call.arguments, conversation.tenantId, conversation.customerId, conversation.id);
        outputs.push({ type: 'function_call_output', call_id: call.callId, output: JSON.stringify(result) });
        if (call.name === 'handoff_to_human') {
          const reply = await this.prisma.message.create({ data: { conversationId: conversation.id, sender: MessageSender.AI, type: MessageType.TEXT, content: 'Claro. Vou encaminhar o atendimento para uma pessoa da equipa.' } });
          return { intent: 'HUMAN_HANDOFF', reply };
        }
      }
      input.push(...turn.toolCalls.map((call) => ({ type: 'function_call', call_id: call.callId, name: call.name, arguments: JSON.stringify(call.arguments) })));
      input.push(...outputs);
      turn = await this.provider.run(input, tools, instructions);
    }

    const response = turn.text || 'Posso ajudar com produtos, preços, disponibilidade e pedidos. O que procura?';
    const reply = await this.prisma.message.create({
      data: { conversationId: conversation.id, sender: MessageSender.AI, type: MessageType.TEXT, content: response },
    });
    return { intent: 'AI_NATURAL_LANGUAGE', reply };
  }

  private buildInstructions(tenantName: string, currency: string, memoryContext: any) {
    return [
      `És o vendedor virtual da empresa ${tenantName}. Atendes clientes em português, de forma natural, curta e útil.`,
      `Moeda da empresa: ${currency}.`,
      'Nunca inventes preço, estoque, produto, prazo, desconto ou condição comercial.',
      'Quando uma informação comercial for necessária, usa as ferramentas disponíveis. O resultado da ferramenta é a única fonte de verdade.',
      'Não digas que tens um produto disponível sem consultar o catálogo/estoque.',
      'Para criar pedido, primeiro identifica o produto e a quantidade. Criar pedido apenas deixa o pedido pendente de confirmação.',
      'Só considera uma venda confirmada quando a ferramenta de confirmação retornar sucesso.',
      'Se o cliente pedir humano, usa a ferramenta de encaminhamento e informa que o atendimento será passado para a equipa.',
      'Se não souberes ou a intenção estiver ambígua, faz uma pergunta curta para esclarecer.',
      'Não exponhas nomes técnicos de ferramentas, IDs internos ou detalhes do backend ao cliente.',
      'A memória serve apenas para contexto e relacionamento. Nunca uses memória como fonte de preço, estoque ou condição comercial.',
      `Contexto conhecido do cliente: ${JSON.stringify(this.compactMemory(memoryContext))}`, 
    ].join('\n');
  }

  private buildTools() {
    const required = (properties: Record<string, unknown>) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
    const requiredWith = (properties: Record<string, unknown>, requiredKeys: string[]) => ({ type: 'object', properties, required: requiredKeys, additionalProperties: false });
    return [
      { type: 'function', name: 'get_customer_context', description: 'Consulta o contexto persistente do cliente, histórico recente de pedidos e oportunidades abertas.', strict: true, parameters: { type: 'object', properties: {}, required: [], additionalProperties: false } },
      { type: 'function', name: 'remember_customer', description: 'Guarda uma preferência ou informação útil fornecida pelo cliente. Não guardar preço ou estoque.', strict: true, parameters: requiredWith({ type: { type: 'string', enum: ['PREFERENCE','PROFILE','NEED','CONTEXT'] }, key: { type: 'string' }, value: { type: 'string' } }, ['type','key','value']) },
      { type: 'function', name: 'search_products', description: 'Procura produtos ativos no catálogo por nome, SKU ou descrição aproximada.', strict: true, parameters: required({ query: { type: 'string' } }) },
      { type: 'function', name: 'get_product_info', description: 'Consulta o preço e o estoque real de um produto.', strict: true, parameters: required({ productId: { type: 'string' } }) },
      { type: 'function', name: 'create_pending_order', description: 'Cria um pedido pendente de confirmação. Não baixa estoque.', strict: true, parameters: required({ productId: { type: 'string' }, quantity: { type: 'integer', minimum: 1, maximum: 1000 } }) },
      { type: 'function', name: 'confirm_pending_order', description: 'Confirma o último pedido pendente e baixa o estoque atomicamente.', strict: true, parameters: { type: 'object', properties: {}, required: [], additionalProperties: false } },
      { type: 'function', name: 'cancel_pending_order', description: 'Cancela o último pedido pendente.', strict: true, parameters: { type: 'object', properties: {}, required: [], additionalProperties: false } },
      { type: 'function', name: 'handoff_to_human', description: 'Passa a conversa para atendimento humano.', strict: true, parameters: { type: 'object', properties: {}, required: [], additionalProperties: false } },
    ];
  }

  private async executeTool(name: string, args: Record<string, unknown>, tenantId: string, customerId: string, conversationId: string) {
    switch (name) {
      case 'get_customer_context': return this.memory.getContext(tenantId, customerId);
      case 'remember_customer': return this.toolRememberCustomer(tenantId, customerId, String(args.type || ''), String(args.key || ''), String(args.value || ''));
      case 'search_products': return this.toolSearchProducts(tenantId, customerId, conversationId, String(args.query || ''));
      case 'get_product_info': return this.toolProductInfo(tenantId, String(args.productId || ''));
      case 'create_pending_order': return this.toolCreateOrder(tenantId, customerId, conversationId, String(args.productId || ''), Number(args.quantity));
      case 'confirm_pending_order': return this.toolConfirmOrder(conversationId, tenantId, customerId);
      case 'cancel_pending_order': return this.toolCancelOrder(conversationId, tenantId, customerId);
      case 'handoff_to_human':
        await this.prisma.conversation.update({ where: { id: conversationId }, data: { status: 'HUMAN_HANDLING' } });
        return { success: true, status: 'HUMAN_HANDLING' };
      default: return { success: false, error: 'UNKNOWN_TOOL' };
    }
  }

  private async toolRememberCustomer(tenantId: string, customerId: string, type: string, key: string, value: string) {
    const allowed = new Set(['PREFERENCE','PROFILE','NEED','CONTEXT']);
    if (!allowed.has(type)) return { success: false, error: 'INVALID_MEMORY_TYPE' };
    const memory = await this.memory.remember(tenantId, customerId, type as any, key, value, 'ai');
    return { success: Boolean(memory) };
  }

  private async toolSearchProducts(tenantId: string, customerId: string, conversationId: string, query: string) {
    const products = await this.findProducts(tenantId, query);
    if (products.length === 1) {
      await this.memory.upsertOpportunity({ tenantId, customerId, conversationId, productId: products[0].id, reason: 'Interesse demonstrado pelo cliente', nextFollowUpAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
    }
    return { products: products.map((p) => ({ id: p.id, name: p.name, sku: p.sku })) };
  }

  private async toolProductInfo(tenantId: string, productId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { currency: true } });
    const p = await this.prisma.product.findFirst({ where: { id: productId, tenantId, active: true }, include: { inventory: true } });
    if (!p) return { found: false };
    return { found: true, id: p.id, name: p.name, sku: p.sku, price: Number(p.basePrice), currency: tenant?.currency || 'AOA', stock: p.inventory?.quantity ?? 0 };
  }

  private async toolCreateOrder(tenantId: string, customerId: string, conversationId: string, productId: string, quantity: number) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) return { success: false, error: 'INVALID_QUANTITY' };
    const product = await this.prisma.product.findFirst({ where: { id: productId, tenantId, active: true }, include: { inventory: true } });
    if (!product) return { success: false, error: 'PRODUCT_NOT_FOUND' };
    const stock = product.inventory?.quantity ?? 0;
    if (stock < quantity) return { success: false, error: 'INSUFFICIENT_STOCK', product: product.name, available: stock };
    const total = Number(product.basePrice) * quantity;
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { currency: true } });
    const order = await this.prisma.order.create({ data: { tenantId, customerId, conversationId, status: OrderStatus.PENDING_CONFIRMATION, total, items: { create: [{ productId, quantity, unitPrice: product.basePrice, subtotal: total }] } } });
    await this.memory.upsertOpportunity({ tenantId, customerId, conversationId, productId, reason: 'Pedido criado e aguardando confirmação', nextFollowUpAt: new Date(Date.now() + 2 * 60 * 60 * 1000) });
    return { success: true, orderId: order.id, product: product.name, quantity, unitPrice: Number(product.basePrice), total, currency: tenant?.currency || 'AOA', requiresConfirmation: true };
  }

  private async toolConfirmOrder(conversationId: string, tenantId: string, customerId: string) {
    const result = await this.confirmPendingOrder(conversationId, tenantId, customerId);
    return { success: result.success, ...result };
  }

  private async toolCancelOrder(conversationId: string, tenantId: string, customerId: string) {
    const result = await this.cancelPendingOrder(conversationId, tenantId, customerId);
    return { success: result.success, ...result };
  }

  private compactMemory(context: any) {
    return {
      customer: context.customer,
      memories: (context.memories ?? []).map((m: any) => ({ type: m.type, key: m.key, value: m.value })).slice(0, 12),
      opportunities: (context.opportunities ?? []).map((o: any) => ({ id: o.id, reason: o.reason, product: o.product?.name, nextFollowUpAt: o.nextFollowUpAt })).slice(0, 8),
      recentOrders: (context.recentOrders ?? []).map((o: any) => ({ status: o.status, total: Number(o.total), createdAt: o.createdAt, items: o.items?.map((i: any) => ({ product: i.product?.name, quantity: i.quantity })) })).slice(0, 5),
    };
  }

  private async handleWithDeterministicFallback(message: any) {
    if (message.type !== MessageType.TEXT || !message.content?.trim()) return null;
    const text = message.content.trim();
    const intent = this.classifyIntent(text);
    let response: string;
    switch (intent) {
      case 'HUMAN_HANDOFF':
        await this.prisma.conversation.update({ where: { id: message.conversationId }, data: { status: 'HUMAN_HANDLING' } });
        response = 'Claro. Vou encaminhar o atendimento para uma pessoa da equipa.';
        break;
      case 'CONFIRM_ORDER':
        response = (await this.confirmPendingOrder(message.conversationId, message.conversation.tenantId, message.conversation.customerId)).message;
        break;
      case 'CANCEL_ORDER':
        response = (await this.cancelPendingOrder(message.conversationId, message.conversation.tenantId, message.conversation.customerId)).message;
        break;
      case 'ORDER': response = await this.handleOrder(message.conversationId, message.conversation.tenantId, message.conversation.customerId, text); break;
      case 'PRICE_OR_AVAILABILITY': response = await this.answerProductQuestion(message.conversation.tenantId, text); break;
      default: response = 'Olá! Posso ajudar com preços, disponibilidade e pedidos. Diga-me o nome do produto que procura.';
    }
    const reply = await this.prisma.message.create({ data: { conversationId: message.conversationId, sender: MessageSender.AI, type: MessageType.TEXT, content: response } });
    return { intent, reply };
  }

  private classifyIntent(text: string): Intent {
    const t = this.normalize(text);
    if (/(humano|atendente|pessoa|vendedor|operador)/.test(t)) return 'HUMAN_HANDOFF';
    if (/^(sim|s|confirmo|confirmar|pode|pode ser|quero)$/.test(t) || /(pode confirmar|confirmo o pedido|pode fechar)/.test(t)) return 'CONFIRM_ORDER';
    if (/^(nao|não|n|cancelar|cancela)$/.test(t) || /(quero cancelar|cancela o pedido)/.test(t)) return 'CANCEL_ORDER';
    if (/(comprar|quero|manda|encomendar|pedido|pedir|levar|reservar)/.test(t)) return 'ORDER';
    if (/(preco|preço|quanto|custa|valor|disponivel|disponível|stock|estoque|tem\b)/.test(t)) return 'PRICE_OR_AVAILABILITY';
    return 'GENERAL';
  }

  private async answerProductQuestion(tenantId: string, text: string) {
    const products = await this.findProducts(tenantId, text);
    if (!products.length) return 'Não encontrei esse produto no catálogo. Pode indicar o nome ou SKU exato?';
    if (products.length > 1) return `Encontrei estes produtos: ${products.slice(0, 5).map((p) => p.name).join(', ')}. Qual deles pretende?`;
    const p = products[0]; const qty = p.inventory?.quantity ?? 0; const price = Number(p.basePrice).toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${p.name}: ${price} AOA. ${qty > 0 ? `Temos ${qty} unidade(s) em stock.` : 'Neste momento está sem stock.'}`;
  }

  private async handleOrder(conversationId: string, tenantId: string, customerId: string, text: string) {
    const products = await this.findProducts(tenantId, text);
    if (!products.length) return 'Não encontrei esse produto. Pode indicar o nome ou SKU exato?';
    if (products.length > 1) return `Encontrei mais de um produto: ${products.slice(0, 5).map((p) => p.name).join(', ')}. Qual deles pretende?`;
    const product = products[0]; const quantity = this.extractQuantity(text); const stock = product.inventory?.quantity ?? 0;
    if (stock < quantity) return stock > 0 ? `Só temos ${stock} unidade(s) de ${product.name}. Quer essa quantidade?` : `${product.name} está sem stock neste momento.`;
    const total = Number(product.basePrice) * quantity;
    await this.prisma.order.create({ data: { tenantId, customerId, conversationId, status: OrderStatus.PENDING_CONFIRMATION, total, items: { create: [{ productId: product.id, quantity, unitPrice: product.basePrice, subtotal: total }] } } });
    await this.memory.upsertOpportunity({ tenantId, customerId, conversationId, productId: product.id, reason: 'Pedido criado e aguardando confirmação', nextFollowUpAt: new Date(Date.now() + 2 * 60 * 60 * 1000) });
    return `Resumo do pedido: ${quantity}x ${product.name} — ${total.toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AOA. Confirma o pedido? Responda "sim" para confirmar ou "cancelar".`;
  }

  private async confirmPendingOrder(conversationId: string, tenantId: string, customerId: string) {
    const order = await this.prisma.order.findFirst({ where: { conversationId, tenantId, customerId, status: OrderStatus.PENDING_CONFIRMATION }, orderBy: { createdAt: 'desc' }, include: { items: { include: { product: { include: { inventory: true } } } } } });
    if (!order) return { success: false, message: 'Não encontrei nenhum pedido pendente para confirmar.' };
    try {
      await this.prisma.$transaction(async (tx) => {
        for (const item of order.items) {
          const updated = await tx.inventory.updateMany({ where: { productId: item.productId, quantity: { gte: item.quantity } }, data: { quantity: { decrement: item.quantity } } });
          if (updated.count !== 1) throw new Error(`INSUFFICIENT_STOCK:${item.product.name}`);
        }
        await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.CONFIRMED } });
      });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('INSUFFICIENT_STOCK:')) return { success: false, message: `O stock de ${error.message.replace('INSUFFICIENT_STOCK:', '')} mudou e já não é suficiente para concluir o pedido.` };
      throw error;
    }
    await this.memory.closeOpportunitiesForProducts(tenantId, customerId, order.items.map((item) => item.productId), 'WON');
    return { success: true, message: `Pedido confirmado. Total: ${Number(order.total).toLocaleString('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AOA. A equipa dará seguimento à entrega/levantamento.` };
  }

  private async cancelPendingOrder(conversationId: string, tenantId: string, customerId: string) {
    const order = await this.prisma.order.findFirst({ where: { conversationId, tenantId, customerId, status: OrderStatus.PENDING_CONFIRMATION }, orderBy: { createdAt: 'desc' }, include: { items: true } });
    if (!order) return { success: false, message: 'Não encontrei nenhum pedido pendente para cancelar.' };
    await this.prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.CANCELLED } });
    await this.memory.closeOpportunitiesForProducts(tenantId, customerId, order.items.map((item) => item.productId), 'LOST');
    return { success: true, message: 'Pedido cancelado. Se quiser, posso ajudar a encontrar outro produto.' };
  }

  private async findProducts(tenantId: string, text: string) {
    const tokens = this.normalize(text).split(/\s+/).filter((x) => x.length >= 3 && !/^\d+$/.test(x) && !['quero','comprar','preco','preço','quanto','custa','valor','temos','tem','stock','estoque','disponivel','disponível','unidades','unidade','por','favor','pedido'].includes(x));
    if (!tokens.length) return [];
    const products = await this.prisma.product.findMany({ where: { tenantId, active: true }, include: { inventory: true }, take: 50 });
    return products.map((p) => ({ p, score: this.scoreProduct(p.name, p.sku, tokens) })).filter((x) => x.score > 0).sort((a,b) => b.score-a.score).slice(0, 5).map((x) => x.p);
  }

  private scoreProduct(name: string, sku: string | null, tokens: string[]) {
    const hay = this.normalize(`${name} ${sku ?? ''}`);
    return tokens.reduce((score, token) => score + (hay === token ? 5 : hay.includes(token) ? 2 : 0), 0);
  }
  private extractQuantity(text: string) { const m = text.match(/\b(\d+)\b/); return Math.max(1, Math.min(1000, m ? Number(m[1]) : 1)); }
  private normalize(text: string) { return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
}
