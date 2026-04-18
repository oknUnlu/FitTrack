import {
  GoogleGenerativeAI,
  Content,
  HarmCategory,
  HarmBlockThreshold,
  type SafetySetting,
} from '@google/generative-ai';
import { logUsage } from './usageLogger';
import { checkBudget } from './budgetGuard';

const API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = 'gemini-2.5-flash';

// Safety settings — block medium+ risk on all supported categories.
// Gemini categories: HARASSMENT, HATE_SPEECH, SEXUALLY_EXPLICIT, DANGEROUS_CONTENT.
// "Dangerous content" is critical for a health/fitness app because it covers
// self-harm, extreme dieting, and unverified medical advice.
const SAFETY_SETTINGS: SafetySetting[] = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// Soft cap on how large a single prompt or system instruction may be.
// Prevents abuse / prompt-stuffing and controls cost.
const MAX_PROMPT_CHARS = 8000;
const MAX_SYSTEM_CHARS = 4000;
const MAX_HISTORY_ITEMS = 20;
const MAX_HISTORY_ITEM_CHARS = 4000;

function truncate(text: string, max: number): string {
  if (typeof text !== 'string') return '';
  return text.length > max ? text.slice(0, max) : text;
}

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

  const safePrompt = truncate(prompt, MAX_PROMPT_CHARS);
  const safeSystem = truncate(systemInstruction, MAX_SYSTEM_CHARS);
  const safeHistory: Content[] = (history || [])
    .slice(-MAX_HISTORY_ITEMS)
    .filter((m) => m && (m.role === 'user' || m.role === 'model') && typeof m.content === 'string')
    .map((msg) => ({
      role: msg.role,
      parts: [{ text: truncate(msg.content, MAX_HISTORY_ITEM_CHARS) }],
    }));

  const start = Date.now();
  const client = getClient();
  const model = client.getGenerativeModel({
    model: MODEL,
    systemInstruction: { role: 'user', parts: [{ text: safeSystem }] },
    safetySettings: SAFETY_SETTINGS,
  });

  const chatSession = model.startChat({ history: safeHistory });

  const result = await chatSession.sendMessage(safePrompt);

  // If the response was blocked by safety filters, surface a safe error.
  const response = result.response;
  const blockReason = response.promptFeedback?.blockReason;
  if (blockReason) {
    throw new Error(`SAFETY_BLOCKED: ${blockReason}`);
  }

  const text = response.text();
  logUsage('chat', Date.now() - start);
  return text;
}

export async function generateContent(
  prompt: string,
  systemInstruction: string
): Promise<string> {
  await ensureBudget();

  const safePrompt = truncate(prompt, MAX_PROMPT_CHARS);
  const safeSystem = truncate(systemInstruction, MAX_SYSTEM_CHARS);

  const start = Date.now();
  const client = getClient();
  const model = client.getGenerativeModel({
    model: MODEL,
    systemInstruction: { role: 'user', parts: [{ text: safeSystem }] },
    safetySettings: SAFETY_SETTINGS,
  });

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: safePrompt }] }],
  });

  const response = result.response;
  const blockReason = response.promptFeedback?.blockReason;
  if (blockReason) {
    throw new Error(`SAFETY_BLOCKED: ${blockReason}`);
  }

  const text = response.text();
  logUsage('plan', Date.now() - start);
  return text;
}

export async function analyzeImage(
  base64Image: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  await ensureBudget();

  // Validate image input to avoid abuse.
  if (typeof base64Image !== 'string' || base64Image.length === 0) {
    throw new Error('INVALID_IMAGE: empty payload');
  }
  // ~5.6 MB base64 ~= 4 MB binary. Hard cap to keep memory/cost in check.
  if (base64Image.length > 8 * 1024 * 1024) {
    throw new Error('INVALID_IMAGE: payload too large');
  }
  const allowedMimes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
  if (!allowedMimes.has(mimeType)) {
    throw new Error('INVALID_IMAGE: unsupported mimeType');
  }

  const safePrompt = truncate(prompt, MAX_PROMPT_CHARS);

  const start = Date.now();
  const client = getClient();
  const model = client.getGenerativeModel({
    model: MODEL,
    safetySettings: SAFETY_SETTINGS,
  });

  const result = await model.generateContent([
    safePrompt,
    {
      inlineData: {
        mimeType,
        data: base64Image,
      },
    },
  ]);

  const response = result.response;
  const blockReason = response.promptFeedback?.blockReason;
  if (blockReason) {
    throw new Error(`SAFETY_BLOCKED: ${blockReason}`);
  }

  const text = response.text();
  logUsage('food_recognition', Date.now() - start);
  return text;
}
