import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AiToolCall {
  callId: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AiTurnResult {
  text: string | null;
  toolCalls: AiToolCall[];
}

@Injectable()
export class AiProviderService {
  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return Boolean(this.config.get<string>('OPENAI_API_KEY'));
  }

  async run(input: unknown[], tools: unknown[], instructions: string): Promise<AiTurnResult> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) throw new ServiceUnavailableException('OPENAI_API_KEY is not configured');

    const model = this.config.get<string>('OPENAI_MODEL') || 'gpt-5.6-luna';
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        instructions,
        input,
        tools,
        tool_choice: 'auto',
        parallel_tool_calls: false,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OPENAI_HTTP_${response.status}:${body.slice(0, 500)}`);
    }

    const data = await response.json() as any;
    const toolCalls: AiToolCall[] = (data.output ?? [])
      .filter((item: any) => item.type === 'function_call')
      .map((item: any) => ({
        callId: item.call_id,
        name: item.name,
        arguments: this.parseArguments(item.arguments),
      }));

    return { text: typeof data.output_text === 'string' && data.output_text.trim() ? data.output_text.trim() : null, toolCalls };
  }

  private parseArguments(raw: unknown): Record<string, unknown> {
    if (typeof raw !== 'string') return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
}
