import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Fetch / transcribe subtitles for any YouTube video using Gemini AI
  app.post('/api/fetch-subtitles', async (req, res) => {
    try {
      const { videoId } = req.body;
      if (!videoId || typeof videoId !== 'string') {
        return res.status(400).json({ error: 'videoId is required' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
      }

      const ai = new GoogleGenAI({ apiKey });
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

      const prompt = `Transcribe the spoken audio of this YouTube video into sequential, timed subtitle cues for language learning.
Return ONLY a valid JSON array of objects with the following schema:
[
  {
    "id": "cue-1",
    "start": 0.0,
    "duration": 3.2,
    "text": "Exact spoken sentence or dialogue segment..."
  }
]
Requirements:
1. "start": start time in seconds (float or integer, e.g. 1.5). Must be chronological.
2. "duration": duration of the segment in seconds (minimum 1.5s).
3. "text": accurate spoken words in the video's spoken language.
4. "id": unique identifier string like "cue-1", "cue-2", etc.
Do not include any conversational filler, markdown explanations, or code blocks other than the raw JSON or json codeblock.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                fileData: {
                  fileUri: videoUrl,
                  mimeType: 'video/*',
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
      });

      const rawText = response.text || '';
      let cleaned = rawText.trim();
      // Remove ```json ... ``` wrapper if present
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.slice(7);
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.slice(3);
      }
      if (cleaned.endsWith('```')) {
        cleaned = cleaned.slice(0, -3);
      }
      cleaned = cleaned.trim();

      let parsedCues: Array<{ id: string; start: number; duration: number; text: string }> = [];
      try {
        parsedCues = JSON.parse(cleaned);
      } catch (parseErr) {
        console.warn('Failed to parse JSON directly, extracting via regex:', parseErr);
        const jsonArrayMatch = cleaned.match(/\[[\s\S]*\]/);
        if (jsonArrayMatch) {
          parsedCues = JSON.parse(jsonArrayMatch[0]);
        }
      }

      if (!Array.isArray(parsedCues) || parsedCues.length === 0) {
        return res.status(404).json({
          error: 'No spoken dialogue or captions could be extracted for this video.',
          raw: rawText,
        });
      }

      // Sanitize cues
      const cues = parsedCues.map((c, idx) => ({
        id: c.id || `cue-${idx + 1}`,
        start: typeof c.start === 'number' && !isNaN(c.start) ? Math.max(0, c.start) : idx * 3,
        duration:
          typeof c.duration === 'number' && !isNaN(c.duration)
            ? Math.max(1.0, c.duration)
            : 3.0,
        text: String(c.text || '').trim(),
      })).filter((c) => c.text.length > 0);

      return res.json({
        success: true,
        videoId,
        cues,
        count: cues.length,
      });
    } catch (err: any) {
      console.error('Error fetching subtitles for video:', err);
      return res.status(500).json({
        error: err.message || 'Failed to fetch subtitles from YouTube.',
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
