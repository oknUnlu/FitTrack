"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chat = chat;
exports.generateContent = generateContent;
exports.analyzeImage = analyzeImage;
const generative_ai_1 = require("@google/generative-ai");
const usageLogger_1 = require("./usageLogger");
const budgetGuard_1 = require("./budgetGuard");
const MODEL = 'gemini-2.5-flash';
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
async function chat(prompt, systemInstruction, history) {
    await ensureBudget();
    const start = Date.now();
    const model = getClient().getGenerativeModel({
        model: MODEL,
        systemInstruction: { role: 'user', parts: [{ text: systemInstruction }] },
    });
    const chatHistory = history.slice(-20).map((m) => ({
        role: m.role,
        parts: [{ text: m.content }],
    }));
    const session = model.startChat({ history: chatHistory });
    const result = await session.sendMessage(prompt);
    const text = result.response.text();
    (0, usageLogger_1.logUsage)('chat', Date.now() - start);
    return text;
}
async function generateContent(prompt, systemInstruction) {
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
    (0, usageLogger_1.logUsage)('plan', Date.now() - start);
    return text;
}
async function analyzeImage(base64Image, mimeType, prompt) {
    await ensureBudget();
    const start = Date.now();
    const model = getClient().getGenerativeModel({ model: MODEL });
    const result = await model.generateContent([
        prompt,
        { inlineData: { mimeType, data: base64Image } },
    ]);
    const text = result.response.text();
    (0, usageLogger_1.logUsage)('food_recognition', Date.now() - start);
    return text;
}
//# sourceMappingURL=gemini.js.map