const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// cache the base prompt so we don't read the file on every request
let cachedBasePrompt = null;

async function generateReplyFromGemini(userMessage, senderName = null, options = {}) {
  if (!GEMINI_API_KEY) {
    return 'API key belum dikonfigurasi. Silakan set environment variable GEMINI_API_KEY.';
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  // baca prompt dasar bila tersedia. Jika file kosong gunakan fallback.
  let basePrompt = '';
  const defaultPrompt = 'Kamu adalah asisten yang membantu menjawab pertanyaan terkait TBC dengan bahasa yang sopan dan jelas.';

  if (cachedBasePrompt === null) {
    try {
      const promptPath = path.join(__dirname, '..', 'prompts', 'prompt.md');
      const fileContent = fs.readFileSync(promptPath, 'utf8') || '';
      cachedBasePrompt = fileContent && fileContent.trim() ? fileContent : defaultPrompt;
    } catch (e) {
      cachedBasePrompt = defaultPrompt;
    }
  }

  basePrompt = cachedBasePrompt;

  const nameContext = senderName && senderName !== '-' ? `Nama pengirim: ${senderName}\n` : '';
  const systemPrompt = `${basePrompt}\n${nameContext}Pesan warga: "${userMessage}"`;

  const requestBody = {
    contents: [{ parts: [{ text: systemPrompt }] }],
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
    ]
  };

  async function postWithRetry(url, body, opts = {}, attempts = 3) {
    let lastErr = null;
    for (let i = 1; i <= attempts; i++) {
      try {
        if (i > 1) console.log(`[GEMINI RETRY] attempt ${i} to ${url}`);
        const res = await axios.post(url, body, opts);
        return res;
      } catch (err) {
        lastErr = err;
        const code = err.response?.status;
        console.warn(`[GEMINI] request failed (attempt ${i}) status=${code} message=${err.message}`);
        if (code && code >= 400 && code < 500 && code !== 429) throw err;
        const delay = 300 * Math.pow(2, i - 1);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw lastErr;
  }

  try {
    const response = await postWithRetry(endpoint, requestBody, { headers: { 'Content-Type': 'application/json' } }, 3);
    const result = response.data;
    const aiReply = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    return aiReply || 'Terima kasih. Mohon jelaskan lebih detail pertanyaan Anda sehingga kami dapat membantu.';
  } catch (error) {
    console.error('[GEMINI API ERROR] message=', error.message);
    if (error.response) {
      console.error('[GEMINI API ERROR] status=', error.response.status);
      console.error('[GEMINI API ERROR] data=', JSON.stringify(error.response.data || {}, null, 2));
    }
    return 'Mohon maaf, layanan AI saat ini tidak tersedia. Silakan coba beberapa saat lagi.';
  }
}

module.exports = { generateReplyFromGemini };
