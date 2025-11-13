const axios = require('axios');
const { generateReplyFromGemini } = require('../services/aiService');
const { sendWhatsappNotif } = require('../services/fonnteService');


let sendWhatsAppMessage = async (phone, text) => {
  if (typeof sendWhatsappNotif === 'function') {
    try {
      return await sendWhatsappNotif(phone, text);
    } catch (e) {
      console.warn('[chatbot.controller] sendWhatsappNotif failed:', e && e.message ? e.message : e);
      return null;
    }
  }
  console.warn('[chatbot.controller] sendWhatsAppMessage: no underlying send function available');
  return null;
};


const handleIncomingMessage = async (req, res) => {
  try {
    console.log('🔵 [WEBHOOK] Incoming webhook at:', new Date().toISOString());

    const number = req.body && (req.body.sender || req.body.phone || req.body.from || req.body.pengirim);
    const message = req.body && (req.body.pesan || req.body.message || req.body.text || null);

    // Only text messages are supported in this controller (image handling removed)
    if (!number || !message) {
      console.log('[WEBHOOK] Missing required fields:', { number, hasMessage: !!message });
      return res.status(400).json({ success: false, message: 'Missing required fields (need number and message)' });
    }

    // Normalize number to Indonesia style '62...'
    let formattedNumber = String(number).trim();
    if (formattedNumber.startsWith('+')) formattedNumber = formattedNumber.slice(1);
    if (formattedNumber.startsWith('0')) formattedNumber = '62' + formattedNumber.slice(1);
    if (!formattedNumber.startsWith('62')) formattedNumber = '62' + formattedNumber;


    const aiResult = await generateReplyFromGemini(message || '', formattedNumber || null, null, { autoSave: false });
  let aiReply = '';
  let parsedAnalysis = {};
  if (typeof aiResult === 'string') aiReply = aiResult;
    else if (typeof aiResult === 'object') {
      aiReply = aiResult.reply || aiResult.deskripsi || '';
      parsedAnalysis = aiResult;
    }

    let cleanReply = aiReply || '';
    try {
      const firstBrace = aiReply.indexOf('{');
      const lastBrace = aiReply.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const maybeJson = aiReply.slice(firstBrace, lastBrace + 1);
        try {
          const obj = JSON.parse(maybeJson);
          parsedAnalysis = { ...parsedAnalysis, ...obj };
          cleanReply = (aiReply.slice(0, firstBrace) + aiReply.slice(lastBrace + 1)).trim();
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      // ignore
    }

    // Build minimal aduan object to store (persistence omitted)
    const dataAduan = {
      nomor: formattedNumber,
      isi: parsedAnalysis.deskripsi || message,
      pesanAsli: message,
      waktu: new Date().toISOString(),
      status: 'masuk',
      kategori: (parsedAnalysis.kategori || 'tidak diketahui'),
      deskripsi: parsedAnalysis.deskripsi || '',
      levelurgensi: parsedAnalysis.levelurgensi || 'sedang'
    };

    console.log('[WEBHOOK] persistence skipped (dataAduan):', dataAduan);

    // send reply
    await sendWhatsAppMessage(formattedNumber, cleanReply || 'Terima kasih, laporan Anda sudah kami terima.');

    return res.status(200).json({ success: true, message: 'Auto-reply sent', aiReply: cleanReply });
  } catch (error) {
    console.error('[WEBHOOK] Error:', error && error.message ? error.message : error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error && error.message ? error.message : String(error) });
  }
};

module.exports = {
  handleIncomingMessage
};
