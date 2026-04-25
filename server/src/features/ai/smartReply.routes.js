const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const logger = require('../../../utils/logger');

router.post('/smart-reply', requireAuth, async (req, res) => {
  try {
    const { messages = [], context = 'channel' } = req.body;
    
    if (!messages.length) {
      return res.json({ suggestions: ['👍', 'Sounds good!', 'On it!'] });
    }

    
    const recent = messages.slice(-5);
    const transcript = recent.map(m => `${m.sender || 'User'}: ${m.text || ''}`).join('\n');

    
    const { default: OpenAI } = await import('openai').catch(() => ({ default: null }));

    if (!OpenAI || !process.env.OPENAI_API_KEY) {
      const fallbacks = [
        ['👍 Got it!', 'Thanks for the update!', 'Will do!'],
        ['Sounds great!', 'I\'ll check it out', 'On it!'],
        ['Thanks!', 'Noted 👍', 'Makes sense!'],
      ];
      return res.json({ suggestions: fallbacks[Math.floor(Math.random() * fallbacks.length)] });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a smart reply assistant for a team chat app. Given the last few messages, generate exactly 3 short, natural reply suggestions (max 8 words each). Return ONLY a JSON array of 3 strings, nothing else.'
        },
        { role: 'user', content: `Recent conversation:\n${transcript}\n\nGenerate 3 short reply suggestions as JSON array:` }
      ],
      max_tokens: 80,
      temperature: 0.8,
      response_format: { type: 'json_object' }
    });

    let suggestions = ['Got it!', 'Thanks!', 'On it!'];
    try {
      const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
      const arr = parsed.suggestions || parsed.replies || Object.values(parsed);
      if (Array.isArray(arr) && arr.length >= 3) {
        suggestions = arr.slice(0, 3).map(s => String(s));
      }
    } catch {  }

    res.json({ suggestions });
  } catch (err) {
    logger.error('Smart reply error:', err);
    res.json({ suggestions: ['Got it!', 'Thanks!', 'Will do!'] }); 
  }
});

router.post('/translate', requireAuth, async (req, res) => {
  try {
    const { text, targetLanguage = 'English' } = req.body;
    if (!text) return res.status(400).json({ message: 'text is required' });

    const { default: OpenAI } = await import('openai').catch(() => ({ default: null }));

    if (!OpenAI || !process.env.OPENAI_API_KEY) {
      return res.status(503).json({ message: 'Translation service not configured' });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Translate the following text to ${targetLanguage}. Return ONLY the translated text, nothing else. Preserve formatting like bullet points or code blocks.`
        },
        { role: 'user', content: text }
      ],
      max_tokens: 500,
      temperature: 0.2
    });

    const translated = completion.choices[0]?.message?.content?.trim() || text;
    res.json({ translated });
  } catch (err) {
    logger.error('Translate error:', err);
    res.status(500).json({ message: 'Translation failed' });
  }
});

module.exports = router;
