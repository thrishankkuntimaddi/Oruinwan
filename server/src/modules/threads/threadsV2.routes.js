const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const Message = require('../../features/messages/message.model');
const logger = require('../../../utils/logger');

router.post('/:messageId/resolve', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { messageId } = req.params;

    const msg = await Message.findById(messageId).select('sender channel dm isResolved');
    if (!msg) return res.status(404).json({ message: 'Thread not found' });

    
    const isNowResolved = !msg.isResolved;
    await Message.findByIdAndUpdate(messageId, {
      isResolved: isNowResolved,
      resolvedBy: isNowResolved ? userId : null,
      resolvedAt: isNowResolved ? new Date() : null
    });

    
    const io = req.app.get('io');
    if (io) {
      const room = msg.channel ? `channel:${msg.channel}` : `dm:${msg.dm}`;
      io.to(room).emit('thread-resolved', {
        messageId,
        isResolved: isNowResolved,
        resolvedBy: userId
      });
    }

    res.json({ isResolved: isNowResolved });
  } catch (err) {
    logger.error('Thread resolve error:', err);
    res.status(500).json({ message: 'Failed to resolve thread' });
  }
});

router.get('/:messageId/ai-summary', requireAuth, async (req, res) => {
  try {
    const { messageId } = req.params;

    
    const parent = await Message.findById(messageId)
      .populate('sender', 'username')
      .lean();
    if (!parent) return res.status(404).json({ message: 'Thread not found' });

    const replies = await Message.find({ parentId: messageId })
      .sort({ createdAt: 1 })
      .limit(50)
      .populate('sender', 'username')
      .lean();

    if (replies.length === 0) {
      return res.json({ summary: 'No replies yet in this thread.' });
    }

    
    const transcript = [
      `Original message by ${parent.sender?.username || 'User'}: "${parent.text || '[encrypted]'}"`,
      ...replies.map(r => `${r.sender?.username || 'User'}: "${r.text || '[encrypted]'}"`)
    ].join('\n');

    
    const { default: OpenAI } = await import('openai').catch(() => ({ default: null }));
    
    if (!OpenAI || !process.env.OPENAI_API_KEY) {
      
      const participants = [...new Set(replies.map(r => r.sender?.username).filter(Boolean))];
      const summary = `This thread has ${replies.length} repl${replies.length > 1 ? 'ies' : 'y'} from ${participants.slice(0, 3).join(', ')}${participants.length > 3 ? ` and ${participants.length - 3} others` : ''}.`;
      return res.json({ summary });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a concise summarizer for team chat threads. Summarize the thread in 2-3 sentences, focusing on decisions made and key points. Be factual and brief.'
        },
        { role: 'user', content: `Summarize this chat thread:\n\n${transcript}` }
      ],
      max_tokens: 150,
      temperature: 0.4
    });

    const summary = completion.choices[0]?.message?.content?.trim() || 'Unable to generate summary.';
    res.json({ summary });
  } catch (err) {
    logger.error('Thread AI summary error:', err);
    res.status(500).json({ message: 'Failed to generate summary' });
  }
});

module.exports = router;
