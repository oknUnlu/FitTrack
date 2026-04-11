import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import { logUsage } from './usageLogger';
import { checkBudget } from './budgetGuard';

const API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = 'gemini-2.5-flash';

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!genAI) {
    if (!API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    genAI = new GoogleGenerativeAI(API_KEY);
  }
  return genAI;
}

async function ensureBudget(): Promise<void> {
  const hasBalance = await checkBudget();
  if (!hasBalance) {
    throw new Error('BUDGET_EXCEEDED: Monthly API budget limit reached');
  }
}

export async function chat(
  prompt: string,
  systemInstruction: string,
  history: { role: 'user' | 'model'; content: string }[]
): Promise<string> {
  await ensureBudget();

  const start = Date.now();
  const client = getClient();
  const model = client.getGenerativeModel({
    model: MODEL,
    systemInstruction: { role: 'user', parts: [{ text: systemInstruction }] },
  });

  const chatHistory: Content[] = history.slice(-20).map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.content }],
  }));

  const chatSession = model.startChat({ history: chatHistory });

  const result = await chatSession.sendMessage(prompt);
  const text = result.response.text();

  logUsage('chat', Date.now() - start);
  return text;
}

export async function generateContent(
  prompt: string,
  systemInstruction: string
): Promise<string> {
  await ensureBudget();

  const start = Date.now();
  const client = getClient();
  const model = client.getGenerativeModel({
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

export async function analyzeImage(
  base64Image: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  await ensureBudget();

  const start = Date.now();
  const client = getClient();
  const model = client.getGenerativeModel({ model: MODEL });

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType,
        data: base64Image,
      },
    },
  ]);

  const text = result.response.text();

  logUsage('food_recognition', Date.now() - start);
  return text;
}
