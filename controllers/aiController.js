import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { chatWithFallback } from '../services/aiProvider.js';
import { createRecord, queryRecords } from '../utils/supabaseDb.js';

const CSAI_DISCLAIMER = "We trained CSAI to be brilliant, not perfect. Mistakes can happen.";

export const chat = asyncHandler(async (req, res) => {
  const { messages, mode } = req.body;

  if (!messages || !Array.isArray(messages)) {
    throw new ApiError(400, 'Messages array is required');
  }

  const result = await chatWithFallback({ messages, mode: mode === 'advanced' ? 'advanced' : 'balanced' });

  // Log interaction for history (only if user is authenticated)
  if (req.user?.id) {
    await createRecord('ai_interactions', {
      user_id: req.user.id,
      feature: 'doubt_solver',
      prompt: messages[messages.length - 1].content,
      response: result.content,
      model: result.provider,
      prompt_tokens: result.usage.promptTokens,
      completion_tokens: result.usage.completionTokens,
      total_tokens: result.usage.totalTokens,
    });
  }

  res.json({
    success: true,
    answer: result.content,
    provider: result.provider,
    disclaimer: CSAI_DISCLAIMER
  });
});

export const getHistory = asyncHandler(async (req, res) => {
  const interactions = await queryRecords('ai_interactions', (i) => i.user_id === req.user.id);

  // Sort by created_at descending and limit to 50
  interactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const history = interactions.slice(0, 50);

  res.json({ success: true, history });
});
