import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatGeminiError(err: unknown): { status: number; message: string; code?: string } {
  const rawMessage = err instanceof Error ? err.message : String(err);
  const lower = rawMessage.toLowerCase();

  if (lower.includes('api_key_invalid') || lower.includes('permission_denied') || lower.includes('403')) {
    return {
      status: 403,
      code: 'PERMISSION_DENIED',
      message:
        'API key permission check failed. Please check or select your Gemini API key in Settings > Secrets.',
    };
  }
  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
    return {
      status: 429,
      code: 'RESOURCE_EXHAUSTED',
      message:
        'This model reached its quota or requires a billing-enabled API key in Settings > Secrets.',
    };
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return {
      status: 404,
      code: 'NOT_FOUND',
      message: `Requested Gemini model was unavailable: ${rawMessage}`,
    };
  }
  if (lower.includes('not configured')) {
    return {
      status: 500,
      code: 'MISSING_KEY',
      message: 'Server Gemini API key is not configured yet. Please check Settings > Secrets.',
    };
  }
  return {
    status: 500,
    code: 'GEMINI_ERROR',
    message: rawMessage || 'Unexpected error communicating with Gemini.',
  };
}

const VALID_VOICES = new Set(['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr']);
const VALID_IMAGE_SIZES = new Set(['1K', '2K', '4K']);
const VALID_ASPECT_RATIOS = new Set(['1:1', '3:4', '4:3', '16:9']);

type ChatModelId =
  | 'gemini-4-hydrogen'
  | 'gemini-4-carbon'
  | 'gemini-4-argon'
  | 'gemini-3.1-flash-lite';

const CHAT_ROLE_CONFIG: Record<
  ChatModelId,
  {
    label: string;
    systemInstruction: string;
  }
> = {
  'gemini-4-hydrogen': {
    label: 'Story Companion',
    systemInstruction:
      'You are Pip, a warm, gentle, curious Story Companion for children ages 4 to 10. Speak in clear, encouraging, age-appropriate language using 2 to 4 short sentences. Help children talk about characters, feelings, and moments on the current page. Always keep content completely safe, kind, and joyful for kids.',
  },
  'gemini-4-carbon': {
    label: 'Deep Wonder Guide',
    systemInstruction:
      'You are Professor Bram, a patient Deep Wonder Guide for curious children and their parents. Use thoughtful, step-by-step reasoning to explain "why" things happen in nature, science, friendship, and story morals connected to the book. Break big ideas into 2 to 3 gentle, wonder-filled steps that an 8-year-old can picture clearly.',
  },
  'gemini-4-argon': {
    label: 'Adventure Architect',
    systemInstruction:
      'You are Captain Loom, an imaginative Adventure Architect for interactive storytelling. Guide the child through playful "what happens next?" choices, gentle riddles, and multi-character mini-scenes inspired by the current page. End each turn with 2 vivid, numbered choices the child can pick next.',
  },
  'gemini-3.1-flash-lite': {
    label: 'Quick Word Helper',
    systemInstruction:
      'You are Spark, a super-fast Quick Word Helper for young readers. Give crisp, friendly 1-to-2 sentence answers: simple definitions of tricky words, fun rhyming words, or easy pronunciation/phonics clues. Keep every answer brief and bright.',
  },
};

const app = express();
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// 1. Text-to-Speech endpoint (gemini-3.8-flash-tts)
app.post('/api/tts', async (req: Request, res: Response) => {
  try {
    const { text, voiceName, readingStyle } = req.body as {
      text?: string;
      voiceName?: string;
      readingStyle?: string;
    };

    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'Story text is required for read-aloud narration.' });
      return;
    }

    const safeVoice = voiceName && VALID_VOICES.has(voiceName) ? voiceName : 'Kore';
    const safeStyle =
      typeof readingStyle === 'string' && readingStyle.trim()
        ? readingStyle.trim().slice(0, 200)
        : 'Warm, expressive children’s storybook narrator with gentle pauses and clear joyful pacing';

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: text.trim().slice(0, 2500),
              speechMetadata: {
                style: safeStyle,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: safeVoice,
            },
          },
        },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    let audioBase64: string | undefined;
    let mimeType = 'audio/wav';

    for (const part of parts) {
      if (part.inlineData?.data) {
        audioBase64 = part.inlineData.data;
        if (part.inlineData.mimeType) {
          mimeType = part.inlineData.mimeType;
        }
        break;
      }
    }

    if (!audioBase64) {
      res.status(502).json({ error: 'Narration audio was not returned by the speech model.' });
      return;
    }

    res.json({
      audioBase64,
      mimeType,
      voiceName: safeVoice,
      model: 'gemini-3.8-flash-tts',
    });
  } catch (err) {
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
  }
});

// 2. Page Illustration Generation endpoint (gemini-3-pro-image-preview with 1K, 2K, 4K)
app.post('/api/illustrate', async (req: Request, res: Response) => {
  try {
    const {
      storyTitle,
      pageText,
      artStyle,
      customPrompt,
      imageSize,
      aspectRatio,
    } = req.body as {
      storyTitle?: string;
      pageText?: string;
      artStyle?: string;
      customPrompt?: string;
      imageSize?: string;
      aspectRatio?: string;
    };

    if ((!pageText || !pageText.trim()) && (!customPrompt || !customPrompt.trim())) {
      res.status(400).json({ error: 'Page text or illustration prompt is required.' });
      return;
    }

    const safeSize = imageSize && VALID_IMAGE_SIZES.has(imageSize) ? imageSize : '1K';
    const safeRatio = aspectRatio && VALID_ASPECT_RATIOS.has(aspectRatio) ? aspectRatio : '4:3';
    const safeStyle =
      typeof artStyle === 'string' && artStyle.trim()
        ? artStyle.trim()
        : 'Warm watercolor and gouache on textured cotton paper';

    const promptParts = [
      `Create a charming, kid-friendly children's picture book illustration in the style of: ${safeStyle}.`,
      storyTitle ? `Book title context: "${storyTitle.trim()}".` : '',
      pageText ? `Scene to illustrate: ${pageText.trim()}` : '',
      customPrompt && customPrompt.trim()
        ? `Special illustration direction: ${customPrompt.trim()}.`
        : '',
      'Composition rules: rich tactile brushwork, expressive warm lighting, gentle whimsical details for children, cohesive character design, strictly NO text, NO words, NO letters, and NO page numbers inside the image.',
    ].filter(Boolean);

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: promptParts.join(' ') }],
      },
      config: {
        imageConfig: {
          aspectRatio: safeRatio,
          imageSize: safeSize,
        },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    let imageUrl: string | undefined;

    for (const part of parts) {
      if (part.inlineData?.data) {
        const mime = part.inlineData.mimeType ?? 'image/png';
        imageUrl = `data:${mime};base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!imageUrl) {
      res.status(502).json({ error: 'Illustration image was not returned by the image model.' });
      return;
    }

    res.json({
      imageUrl,
      imageSize: safeSize,
      aspectRatio: safeRatio,
      model: 'gemini-3-pro-image-preview',
    });
  } catch (err) {
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
  }
});

// 3. Create Custom Multi-Page Story endpoint (gemini-4-hydrogen)
app.post('/api/story/create', async (req: Request, res: Response) => {
  try {
    const { topic, ageBand, artStyle, pageCount } = req.body as {
      topic?: string;
      ageBand?: string;
      artStyle?: string;
      pageCount?: number;
    };

    if (!topic || !topic.trim()) {
      res.status(400).json({ error: 'Please share a story idea or hero first.' });
      return;
    }

    const safePages = Math.min(6, Math.max(3, Number(pageCount) || 4));
    const safeAge = ageBand?.trim() || 'Ages 5–8';
    const safeStyle = artStyle?.trim() || 'Warm Watercolor & Gouache';

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Write an original, enchanting ${safePages}-page children's picture book about: "${topic.trim()}". Target audience: ${safeAge}. Preferred illustration style: ${safeStyle}. Each page should have 2 to 4 musical, read-aloud sentences with gentle sensory details, a short chapter heading, a specific visual scene prompt for an illustrator (mentioning the main character consistently across every page), and one playful wonder question to ask the child after reading that page.`,
      config: {
        systemInstruction:
          'You are an award-winning children’s picture book author. Write gentle, rhythmic, imaginative stories meant to be read aloud at bedtime or storytime. Avoid scary or harmful themes. Return valid JSON matching the schema.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Storybook title' },
            subtitle: { type: Type.STRING, description: 'Short lyrical subtitle' },
            ageBand: { type: Type.STRING, description: 'Recommended age range' },
            pages: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  pageNumber: { type: Type.INTEGER },
                  heading: { type: Type.STRING, description: 'Short 2-4 word page heading' },
                  text: { type: Type.STRING, description: 'Read-aloud story text for this page' },
                  illustrationPrompt: {
                    type: Type.STRING,
                    description: 'Detailed visual scene description for generating the page artwork',
                  },
                  wonderQuestion: {
                    type: Type.STRING,
                    description: 'One curious discussion question for the young reader',
                  },
                },
                required: ['pageNumber', 'heading', 'text', 'illustrationPrompt', 'wonderQuestion'],
              },
            },
          },
          required: ['title', 'subtitle', 'ageBand', 'pages'],
        },
      },
    });

    const rawJson = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawJson) as {
      title?: string;
      subtitle?: string;
      ageBand?: string;
      pages?: Array<{
        pageNumber: number;
        heading: string;
        text: string;
        illustrationPrompt: string;
        wonderQuestion: string;
      }>;
    };

    if (!parsed.title || !Array.isArray(parsed.pages) || parsed.pages.length === 0) {
      res.status(502).json({ error: 'Could not structure the new story pages. Please try again.' });
      return;
    }

    res.json({
      title: parsed.title,
      subtitle: parsed.subtitle || 'An original picture book adventure',
      ageBand: parsed.ageBand || safeAge,
      artStyle: safeStyle,
      pages: parsed.pages,
    });
  } catch (err) {
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
  }
});

// 4. Multi-Turn Story Buddy Chatbot endpoint
// Supports gemini-4-hydrogen, gemini-4-carbon, gemini-4-argon, gemini-3.1-flash-lite
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { model, message, history, storyContext } = req.body as {
      model?: string;
      message?: string;
      history?: Array<{ role: 'user' | 'model'; text: string }>;
      storyContext?: {
        title?: string;
        pageNumber?: number;
        totalPages?: number;
        pageHeading?: string;
        pageText?: string;
      };
    };

    if (!message || !message.trim()) {
      res.status(400).json({ error: 'Please type a message for Story Buddy.' });
      return;
    }

    const selectedModel: ChatModelId =
      model && model in CHAT_ROLE_CONFIG ? (model as ChatModelId) : 'gemini-4-hydrogen';
    const roleConfig = CHAT_ROLE_CONFIG[selectedModel];

    const contextAppendix = storyContext?.title
      ? `\n\nCurrent storybook context:\n- Book Title: "${storyContext.title}"\n- Page ${storyContext.pageNumber ?? 1} of ${storyContext.totalPages ?? 1}${storyContext.pageHeading ? ` (${storyContext.pageHeading})` : ''}\n- Page Text: "${storyContext.pageText ?? ''}"`
      : '';

    const formattedHistory = Array.isArray(history)
      ? history
          .filter((item) => item && (item.role === 'user' || item.role === 'model') && typeof item.text === 'string' && item.text.trim())
          .slice(-24)
          .map((item) => ({
            role: item.role,
            parts: [{ text: item.text }],
          }))
      : [];

    const ai = getAiClient();
    const chat = ai.chats.create({
      model: selectedModel,
      history: formattedHistory,
      config: {
        systemInstruction: `${roleConfig.systemInstruction}${contextAppendix}`,
      },
    });

    const response = await chat.sendMessage({
      message: message.trim().slice(0, 1500),
    });

    const replyText = response.text?.trim();
    if (!replyText) {
      res.status(502).json({ error: 'Story Buddy did not return a reply. Please try again.' });
      return;
    }

    res.json({
      reply: replyText,
      model: selectedModel,
      roleLabel: roleConfig.label,
    });
  } catch (err) {
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
  }
});

async function startServer() {
  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      const indexHtml = path.join(distPath, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Loom & Lantern server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
