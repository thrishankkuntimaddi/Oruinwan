'use strict';

let _genAI = null;

function getModel(modelName = 'gemini-1.5-flash') {
  if (!_genAI) {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || '';
    if (!apiKey) {
      console.warn('[AI Gateway] ⚠️  No Gemini API key — AI features will use fallback responses.');
    }
    _genAI = new GoogleGenerativeAI(apiKey);
    console.log(`✅ [AI Gateway] Initialised with API Key (length: ${apiKey.length})`);
  }
  return _genAI.getGenerativeModel({ model: modelName });
}

async function _generate(prompt) {
  const model = getModel();
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

async function chat({ message, history = [], workspaceId }, { userId } = {}) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;
  if (!apiKey) {
    return { text: 'AI is not configured. Please add a GEMINI_API_KEY to your environment.' };
  }

  try {
    
    const historyText = history
      .map(h => `${h.role === 'assistant' ? 'Assistant' : 'User'}: ${h.content}`)
      .join('\n');

    const fullPrompt = historyText
      ? `${historyText}\nUser: ${message}\nAssistant:`
      : message;

    const text = await _generate(fullPrompt);
    return { text };
  } catch (err) {
    console.error('[AI Gateway] chat error:', err.message);
    return { text: 'AI is temporarily unavailable. Please try again later.' };
  }
}

async function summarize({ text }, { userId } = {}) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;
  if (!apiKey || !text?.trim()) {
    const fallback = (text || '').replace(/[#*>`_[\]]/g, '').replace(/\s+/g, ' ').trim().substring(0, 300);
    return { summary: fallback || 'No content to summarise.' };
  }

  try {
    const prompt = [
      'You are a concise technical writer.',
      'Summarise the following content in 2–4 clear, informative sentences.',
      'Return ONLY the summary — no bullet points, no headings, no formatting.',
      `\n---\n${text.substring(0, 8000)}`,
    ].join('\n');

    const summary = await _generate(prompt);
    return { summary };
  } catch (err) {
    console.error('[AI Gateway] summarize error:', err.message);
    const fallback = (text || '').replace(/[#*>`_[\]]/g, '').replace(/\s+/g, ' ').trim().substring(0, 300);
    return { summary: fallback || 'Summary unavailable.' };
  }
}

async function generateTask({ context }, { userId } = {}) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;
  if (!apiKey) {
    return { title: 'New Task', priority: 'medium', description: context || '' };
  }

  try {
    const prompt = [
      'Given the following context, extract a structured task.',
      'Respond ONLY with a valid JSON object with these keys: "title" (string), "priority" ("low"|"medium"|"high"), "description" (string, max 2 sentences).',
      'No markdown fences, no extra text.',
      `\nContext: "${context}"`,
    ].join('\n');

    let raw = await _generate(prompt);
    
    raw = raw.replace(/^```(?:json)?/m, '').replace(/```$/m, '').trim();

    const parsed = JSON.parse(raw);
    return {
      title: parsed.title || 'New Task',
      priority: ['low', 'medium', 'high'].includes(parsed.priority) ? parsed.priority : 'medium',
      description: parsed.description || '',
    };
  } catch (err) {
    console.error('[AI Gateway] generateTask error:', err.message);
    return { title: 'New Task', priority: 'medium', description: context || '' };
  }
}

module.exports = { chat, summarize, generateTask };
