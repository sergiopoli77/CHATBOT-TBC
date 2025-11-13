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

    // detect image fields (several provider shapes)
    let image = req.body && (req.body.image || req.body.file || req.body.media || req.body.mediaUrl || req.body.fileUrl || req.body.url || null);
    if (!image && req.body && req.body.attachments && Array.isArray(req.body.attachments) && req.body.attachments[0] && req.body.attachments[0].url) {
      image = req.body.attachments[0].url;
    }
    if (!image && req.body && req.body.messages && Array.isArray(req.body.messages) && req.body.messages[0]) {
      const m0 = req.body.messages[0];
      if (m0.image) image = m0.image.url || m0.image.base64 || image;
      if (!image && (m0.url || m0.mediaUrl || m0.body)) image = m0.url || m0.mediaUrl || m0.body;
    }
    if (!image && req.body && (req.body.data || req.body.base64)) {
      image = req.body.data || req.body.base64;
    }

    if (!number || (!message && !image)) {
      console.log('[WEBHOOK] Missing required fields:', { number, hasMessage: !!message, hasImage: !!image });
      return res.status(400).json({ success: false, message: 'Missing required fields (need number and message or image)' });
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

  // persistence omitted: replace with real DB save when wiring
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
