import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import { logUsage } from './usageLogger';
import { checkBudget } from './budgetGuard';

const MODEL = 'gemini-2.5-flash';
let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

async function ensureBudget(): Promise<void> {
  const ok = await checkBudget();
  if (!ok) throw new Error('BUDGET_EXCEEDED: Monthly API budget limit reached');
}

export async function chat(
  prompt: string,
  systemInstruction: string,
  history: { role: 'user' | 'model'; content: string }[]
): Promise<string> {
  await ensureBudget();
  const start = Date.now();
  const model = getClient().getGenerativeModel({
    model: MODEL,
    systemInstruction: { role: 'user', parts: [{ text: systemInstruction }] },
  });
  const chatHistory: Content[] = history.slice(-20).map((m) => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));
  const session = model.startChat({ history: chatHistory });
  const result = await session.sendMessage(prompt);
  const text = result.response.text();
  logUsage('chat', Date.now() - start);
  return text;
}

export async function generateContent(prompt: string, systemInstruction: string): Promise<string> {
  await ensureBudget();
  const start = Date.now();
  const model = getClient().getGenerativeModel({
    model: MODEL,
    systemInstruction: { role: 'user', parts: [{ text: systemInstruction }] },
  });
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });
  const text = result.response.text();
  logUsage('plan', Date.now() - start);
  return text;
}

export async function analyzeImage(base64Image: string, mimeType: string, prompt: string): Promise<string> {
  await ensureBudget();
  const start = Date.now();
  const model = getClient().getGenerativeModel({ model: MODEL });
  const result = await model.generateContent([
    prompt,
    { inlineData: { mimeType, data: base64Image } },
  ]);
  const text = result.response.text();
  logUsage('food_recognition', Date.now() - start);
  return text;
}
