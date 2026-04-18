import {
  GoogleGenerativeAI,
  Content,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai';
import { logUsage } from './usageLogger';
import { checkBudget } from './budgetGuard';

const MODEL = 'gemini-2.5-flash';

// Hard caps — refuse oversize inputs in the server itself so an abusive
// client can't cause unbounded cost or exceed Gemini's own safety envelope.
const MAX_PROMPT_CHARS = 8000;
const MAX_SYSTEM_CHARS = 4000;
const MAX_HISTORY_ITEMS = 20;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

// Safety policy — Gemini can still leak harmful output at permissive
// thresholds. We clamp all four categories to BLOCK_MEDIUM_AND_ABOVE.
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

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

function truncate(s: string | undefined, max: number): string {
  if (!s) return '';
  if (typeof s !== 'string') return '';
  return s.length > max ? s.slice(0, max) : s;
}

function checkBlockReason(response: any): string {
  const blockReason = response?.promptFeedback?.blockReason;
  if (blockReason) {
    throw new Error(`SAFETY_BLOCKED: ${blockReason}`);
  }
  return response?.text?.() ?? '';
}

export async function chat(
  prompt: string,
  systemInstruction: string,
  history: { role: 'user' | 'model'; content: string }[]
): Promise<string> {
  await ensureBudget();
  const start = Date.now();
  const safePrompt = truncate(prompt, MAX_PROMPT_CHARS);
  const safeSystem = truncate(systemInstruction, MAX_SYSTEM_CHARS);

  const model = getClient().getGenerativeModel({
    model: MODEL,
    systemInstruction: { role: 'user', parts: [{ text: safeSystem }] },
    safetySettings: SAFETY_SETTINGS,
  });

  const chatHistory: Content[] = (Array.isArray(history) ? history : [])
    .slice(-MAX_HISTORY_ITEMS)
    .filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'model'))
    .map((m) => ({
      role: m.role,
      parts: [{ text: truncate(m.content, MAX_PROMPT_CHARS) }],
    }));

  const session = model.startChat({ history: chatHistory });
  const result = await session.sendMessage(safePrompt);
  const text = checkBlockReason(result.response);
  logUsage('chat', Date.now() - start);
  return text;
}

export async function generateContent(prompt: string, systemInstruction: string): Promise<string> {
  await ensureBudget();
  const start = Date.now();
  const safePrompt = truncate(prompt, MAX_PROMPT_CHARS);
  const safeSystem = truncate(systemInstruction, MAX_SYSTEM_CHARS);

  const model = getClient().getGenerativeModel({
    model: MODEL,
    systemInstruction: { role: 'user', parts: [{ text: safeSystem }] },
    safetySettings: SAFETY_SETTINGS,
  });
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: safePrompt }] }],
  });
  const text = checkBlockReason(result.response);
  logUsage('plan', Date.now() - start);
  return text;
}

export async function analyzeImage(
  base64Image: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  await ensureBudget();

  // Validate image inputs before we ever ship them to Gemini.
  if (typeof base64Image !== 'string' || !base64Image.length) {
    throw new Error('INVALID_IMAGE: empty payload');
  }
  if (!ALLOWED_MIMES.has(mimeType)) {
    throw new Error(`INVALID_IMAGE: unsupported mimeType ${mimeType}`);
  }
  // Rough base64→bytes size estimate: 3/4 of string length.
  const approxBytes = Math.floor((base64Image.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    throw new Error('INVALID_IMAGE: exceeds 8MB cap');
  }

  const safePrompt = truncate(prompt, MAX_PROMPT_CHARS);
  const start = Date.now();
  const model = getClient().getGenerativeModel({
    model: MODEL,
    safetySettings: SAFETY_SETTINGS,
  });
  const result = await model.generateContent([
    safePrompt,
    { inlineData: { mimeType, data: base64Image } },
  ]);
  const text = checkBlockReason(result.response);
  logUsage('food_recognition', Date.now() - start);
  return text;
}
