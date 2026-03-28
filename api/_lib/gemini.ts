import { GoogleGenerativeAI, Content } from '@google/generative-ai';

const API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = 'gemini-2.0-flash';

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

export async function chat(
  prompt: string,
  systemInstruction: string,
  history: { role: 'user' | 'model'; content: string }[]
): Promise<string> {
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
  return result.response.text();
}

export async function generateContent(
  prompt: string,
  systemInstruction: string
): Promise<string> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: MODEL,
    systemInstruction: { role: 'user', parts: [{ text: systemInstruction }] },
  });

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });

  return result.response.text();
}

export async function analyzeImage(
  base64Image: string,
  mimeType: string,
  prompt: string
): Promise<string> {
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

  return result.response.text();
}
