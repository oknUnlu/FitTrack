"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chat = chat;
exports.generateContent = generateContent;
exports.analyzeImage = analyzeImage;
const generative_ai_1 = require("@google/generative-ai");
const usageLogger_1 = require("./usageLogger");
const budgetGuard_1 = require("./budgetGuard");
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
    { category: generative_ai_1.HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: generative_ai_1.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: generative_ai_1.HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: generative_ai_1.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: generative_ai_1.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: generative_ai_1.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: generative_ai_1.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: generative_ai_1.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];
let genAI = null;
function getClient() {
    if (!genAI) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey)
            throw new Error('GEMINI_API_KEY is not configured');
        genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    }
    return genAI;
}
async function ensureBudget() {
    const ok = await (0, budgetGuard_1.checkBudget)();
    if (!ok)
        throw new Error('BUDGET_EXCEEDED: Monthly API budget limit reached');
}
function truncate(s, max) {
    if (!s)
        return '';
    if (typeof s !== 'string')
        return '';
    return s.length > max ? s.slice(0, max) : s;
}
function checkBlockReason(response) {
    var _a, _b, _c;
    const blockReason = (_a = response === null || response === void 0 ? void 0 : response.promptFeedback) === null || _a === void 0 ? void 0 : _a.blockReason;
    if (blockReason) {
        throw new Error(`SAFETY_BLOCKED: ${blockReason}`);
    }
    return (_c = (_b = response === null || response === void 0 ? void 0 : response.text) === null || _b === void 0 ? void 0 : _b.call(response)) !== null && _c !== void 0 ? _c : '';
}
async function chat(prompt, systemInstruction, history) {
    await ensureBudget();
    const start = Date.now();
    const safePrompt = truncate(prompt, MAX_PROMPT_CHARS);
    const safeSystem = truncate(systemInstruction, MAX_SYSTEM_CHARS);
    const model = getClient().getGenerativeModel({
        model: MODEL,
        systemInstruction: { role: 'user', parts: [{ text: safeSystem }] },
        safetySettings: SAFETY_SETTINGS,
    });
    const chatHistory = (Array.isArray(history) ? history : [])
        .slice(-MAX_HISTORY_ITEMS)
        .filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'model'))
        .map((m) => ({
        role: m.role,
        parts: [{ text: truncate(m.content, MAX_PROMPT_CHARS) }],
    }));
    const session = model.startChat({ history: chatHistory });
    const result = await session.sendMessage(safePrompt);
    const text = checkBlockReason(result.response);
    (0, usageLogger_1.logUsage)('chat', Date.now() - start);
    return text;
}
async function generateContent(prompt, systemInstruction) {
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
    (0, usageLogger_1.logUsage)('plan', Date.now() - start);
    return text;
}
async function analyzeImage(base64Image, mimeType, prompt) {
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
    (0, usageLogger_1.logUsage)('food_recognition', Date.now() - start);
    return text;
}
//# sourceMappingURL=gemini.js.map