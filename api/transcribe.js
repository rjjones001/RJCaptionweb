// Vercel serverless function: sends a short WAV clip to Whisper large-v3 and returns word timestamps.
// Set ONE of these in Vercel > Project > Settings > Environment Variables, then redeploy:
//   GROQ_API_KEY   (uses whisper-large-v3)
//   OPENAI_API_KEY (uses whisper-1)
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const groq = process.env.GROQ_API_KEY;
  const openai = process.env.OPENAI_API_KEY;
  if (!groq && !openai) return res.status(500).json({ error: 'nokey' });

  const parts = [];
  for await (const p of req) parts.push(p);
  const audio = Buffer.concat(parts);

  const lang = (req.query && req.query.lang) || '';
  const prompt = (req.query && req.query.prompt) || '';

  const fd = new FormData();
  fd.append('file', new Blob([audio], { type: 'audio/wav' }), 'audio.wav');
  fd.append('model', groq ? 'whisper-large-v3' : 'whisper-1');
  fd.append('response_format', 'verbose_json');
  fd.append('timestamp_granularities[]', 'word');
  fd.append('timestamp_granularities[]', 'segment');
  fd.append('temperature', '0');
  if (lang) fd.append('language', lang);
  if (prompt) fd.append('prompt', prompt);

  try {
    const r = await fetch(
      groq ? 'https://api.groq.com/openai/v1/audio/transcriptions'
           : 'https://api.openai.com/v1/audio/transcriptions',
      { method: 'POST', headers: { Authorization: 'Bearer ' + (groq || openai) }, body: fd }
    );
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(502).json({ error: { message: 'Transcription service unreachable' } });
  }
};

module.exports.config = { api: { bodyParser: false } };
