import { HealthController } from './health.controller';
test('health reports service status', () => {
  expect(new HealthController().check()).toEqual({ ok: true, service: 'weto-ai-sales', version: '0.1.0' });
});
