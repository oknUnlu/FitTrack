/**
 * Quick local test script for API endpoints.
 * Run: npx tsx api/_test.ts
 */
import { config } from 'dotenv';
config({ path: '.env' });

const BASE = 'http://localhost:3000/api';
const AUTH = 'Bearer 12345678-1234-1234-1234-123456789abc';

async function testHealth() {
  console.log('\n=== /api/health ===');
  // We can't call the HTTP server directly without vercel dev,
  // so let's test the modules directly.
  const { default: handler } = await import('./health');

  const req: any = { method: 'GET', headers: {} };
  const res: any = {
    _status: 0,
    _body: null,
    status(code: number) { this._status = code; return this; },
    json(body: any) { this._body = body; return this; },
    setHeader() { return this; },
  };

  handler(req, res);
  console.log('Status:', res._status);
  console.log('Body:', JSON.stringify(res._body, null, 2));
}

async function testChat() {
  console.log('\n=== /api/chat ===');
  const { default: handler } = await import('./chat');

  const req: any = {
    method: 'POST',
    headers: {
      authorization: AUTH,
      'x-premium': 'false',
      'content-type': 'application/json',
    },
    body: {
      prompt: 'Merhaba, bugün nasıl antrenman yapmalıyım?',
      systemInstruction: 'Sen bir fitness koçusun. Kısa ve öz cevap ver.',
      history: [],
    },
  };

  const res: any = {
    _status: 0,
    _body: null,
    status(code: number) { this._status = code; return this; },
    json(body: any) { this._body = body; return this; },
    setHeader() { return this; },
  };

  await handler(req, res);
  console.log('Status:', res._status);
  console.log('Body:', JSON.stringify(res._body, null, 2));
}

async function testPlan() {
  console.log('\n=== /api/plan ===');
  const { default: handler } = await import('./plan');

  const req: any = {
    method: 'POST',
    headers: {
      authorization: AUTH,
      'x-premium': 'false',
      'content-type': 'application/json',
    },
    body: {
      planPrompt: 'Başlangıç seviyesi için 3 günlük antrenman planı oluştur.',
      systemInstruction: 'Sen bir fitness koçusun. Kısa ve öz plan ver.',
    },
  };

  const res: any = {
    _status: 0,
    _body: null,
    status(code: number) { this._status = code; return this; },
    json(body: any) { this._body = body; return this; },
    setHeader() { return this; },
  };

  await handler(req, res);
  console.log('Status:', res._status);
  console.log('Body:', JSON.stringify(res._body, null, 2));
}

(async () => {
  try {
    await testHealth();
    await testChat();
    await testPlan();
    console.log('\n✅ All tests passed!');
  } catch (err) {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
  }
})();
