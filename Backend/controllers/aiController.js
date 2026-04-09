import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { chatWithFallback } from '../services/aiProvider.js';
import { supabase } from '../config/supabase.js';

const CSAI_DISCLAIMER = "We trained CSAI to be brilliant, not perfect. Mistakes can happen.";

export const chat = asyncHandler(async (req, res) => {
  const { messages, mode } = req.body;

  if (!messages || !Array.isArray(messages)) {
    throw new ApiError(400, 'Messages array is required');
  }

  const result = await chatWithFallback({ messages, mode: mode === 'advanced' ? 'advanced' : 'balanced' });

  // Log interaction for history (only if user is authenticated)
  if (req.user?.id) {
    await supabase.from('ai_interactions').insert({
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
  const { data, error } = await supabase
    .from('ai_interactions')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  res.json({ success: true, history: data });
});
