import { Router } from 'express';

const router = Router();
type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY || process.env.VITE_CEREBRAS_API_KEY || '';

function mapGeminiContents(messages: ChatMessage[]) {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
}

async function callGemini(messages: ChatMessage[], systemPrompt?: string): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('Gemini API key is missing');
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: mapGeminiContents(messages),
        systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
    }
  );
  const data: any = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!response.ok || !text) throw new Error(data?.error?.message || 'Gemini returned no response');
  return text;
}

async function callCerebras(messages: ChatMessage[], systemPrompt?: string): Promise<string> {
  if (!CEREBRAS_API_KEY) throw new Error('Cerebras API key is missing');
  const allMessages = [
    ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
    ...messages,
  ];
  const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CEREBRAS_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-4-scout-17b-16e-instruct',
      messages: allMessages,
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });
  const data: any = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!response.ok || !text) throw new Error(data?.error?.message || 'Cerebras returned no response');
  return text;
}

// POST /api/ai/chat
router.post('/chat', async (req, res) => {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7648/ingest/9083a094-cb0a-4860-b6f2-236bb876b0d0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6a311b'},body:JSON.stringify({sessionId:'6a311b',runId:'pre-fix',hypothesisId:'H1',location:'routes/ai.ts:chat-entry',message:'routes/ai chat handler entered',data:{hasMessages:Array.isArray(req.body?.messages),model:req.body?.model || 'none'},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const body = req.body as { messages?: ChatMessage[]; model?: string; systemPrompt?: string };
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const systemPrompt = typeof body.systemPrompt === 'string' ? body.systemPrompt : undefined;

    if (!messages.length) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    let responseText = '';
    try {
      // Gemini is the default model used in AI Lab.
      responseText = await callGemini(messages, systemPrompt);
      // #region agent log
      fetch('http://127.0.0.1:7648/ingest/9083a094-cb0a-4860-b6f2-236bb876b0d0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6a311b'},body:JSON.stringify({sessionId:'6a311b',runId:'pre-fix',hypothesisId:'H2',location:'routes/ai.ts:gemini-success',message:'routes/ai gemini success',data:{responseLength:responseText.length},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return res.json({ response: responseText, provider: 'gemini', model: body.model || 'gemini' });
    } catch (geminiErr) {
      // #region agent log
      fetch('http://127.0.0.1:7648/ingest/9083a094-cb0a-4860-b6f2-236bb876b0d0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6a311b'},body:JSON.stringify({sessionId:'6a311b',runId:'pre-fix',hypothesisId:'H3',location:'routes/ai.ts:gemini-failed',message:'routes/ai gemini failed',data:{error:geminiErr instanceof Error ? geminiErr.message : 'unknown'},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      // Fallback to Cerebras when Gemini fails or is not configured.
      responseText = await callCerebras(messages, systemPrompt);
      return res.json({ response: responseText, provider: 'cerebras', model: body.model || 'cerebras' });
    }
  } catch (error: any) {
    // #region agent log
    fetch('http://127.0.0.1:7648/ingest/9083a094-cb0a-4860-b6f2-236bb876b0d0',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6a311b'},body:JSON.stringify({sessionId:'6a311b',runId:'pre-fix',hypothesisId:'H4',location:'routes/ai.ts:chat-error',message:'routes/ai chat outer error',data:{error:error?.message || 'unknown'},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return res.status(500).json({
      error: 'AI chat failed',
      message: error?.message || 'Unknown error',
    });
  }
});

// POST /api/ai/grade
router.post('/grade', (req, res) => {
    res.json({ message: 'AI grade endpoint not implemented yet' });
});

// POST /api/ai/study-plan
router.post('/study-plan', (req, res) => {
    res.json({ message: 'AI study plan endpoint not implemented yet' });
});

// GET /api/ai/models
router.get('/models', (req, res) => {
  res.json({
    models: [
      { id: 'gemini', label: 'Gemini 2.0 Flash', provider: 'google' },
      { id: 'gpt-oss-120b', label: 'GPT-OSS 120B', provider: 'cerebras' },
      { id: 'llama-3.3-70b', label: 'Llama 3.3 70B', provider: 'groq' },
      { id: 'qwen-3-235b', label: 'Qwen 3 235B', provider: 'cerebras' },
    ],
  });
});

// POST /api/ai/transcribe
router.post('/transcribe', (req, res) => {
    res.json({ message: 'AI transcribe endpoint not implemented yet' });
});

// POST /api/ai/tts
router.post('/tts', (req, res) => {
    res.json({ message: 'AI TTS endpoint not implemented yet' });
});

export default router;