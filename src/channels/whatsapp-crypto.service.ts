import { BadRequestException, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

@Injectable()
export class WhatsAppCryptoService {
  private readonly key: Buffer;

  constructor() {
    const secret = process.env.APP_ENCRYPTION_KEY;
    if (!secret) throw new Error('APP_ENCRYPTION_KEY is required');
    this.key = createHash('sha256').update(secret).digest();
  }

  encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
  }

  decrypt(payload: string) {
    try {
      const [ivRaw, tagRaw, encryptedRaw] = payload.split('.');
      if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error('Invalid encrypted value');
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivRaw, 'base64url'));
      decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
      return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, 'base64url')), decipher.final()]).toString('utf8');
    } catch {
      throw new BadRequestException('Invalid encrypted channel credential');
    }
  }
}
