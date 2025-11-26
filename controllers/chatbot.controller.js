const { generateReplyFromGemini } = require('../services/aiService');
const { sendWhatsappNotif } = require('../services/fonnteService');
const sessionContext = require('../utils/sessionContext');

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

// Minimal webhook: receive text, forward to AI, and reply if AI returns text.
const handleIncomingMessage = async (req, res) => {
  try {
    const number = req.body && (req.body.sender || req.body.phone || req.body.from || req.body.pengirim);
    const message = req.body && (req.body.pesan || req.body.message || req.body.text || null);

    if (!number || !message) {
      return res.status(400).json({ success: false, message: 'Missing required fields (need number and message)' });
    }

    // Normalize number to Indonesia style '62...'
    let formattedNumber = String(number).trim();
    if (formattedNumber.startsWith('+')) formattedNumber = formattedNumber.slice(1);
    if (formattedNumber.startsWith('0')) formattedNumber = '62' + formattedNumber.slice(1);
    if (!formattedNumber.startsWith('62')) formattedNumber = '62' + formattedNumber;

    // check if user is telling their name (simple heuristics)
    const nameSetRegex = /(?:^|\b)(?:nama saya|namaku|saya nama|aku nama)\s+(.{1,60})/i;
    const whoAmIRegex = /(?:^|\b)(?:siapa nama saya|siapa namaku)\b/i;

    const nameSetMatch = message.match(nameSetRegex);
    if (nameSetMatch) {
      const givenName = nameSetMatch[1].trim();
      if (givenName) {
        sessionContext.setUserName(formattedNumber, givenName);
        const replyText = `Oh begitu ya. Baik, saya ingat nama kamu sebagai ${givenName}. Kalau butuh saya panggil kamu dengan nama itu, bilang saja ya.`;
        await sendWhatsAppMessage(formattedNumber, replyText);
        return res.status(200).json({ success: true, sent: true, reply: replyText });
      }
    }

    // user asking what their name is
    if (whoAmIRegex.test(message)) {
      const stored = sessionContext.getUserName(formattedNumber);
      const replyText = stored ? `Namamu tercatat sebagai ${stored}.` : 'Sepertinya saya belum tahu nama kamu. Kamu bisa bilang "nama saya [namamu]" supaya saya ingat.';
      await sendWhatsAppMessage(formattedNumber, replyText);
      return res.status(200).json({ success: true, sent: true, reply: replyText });
    }

    // retrieve stored name (if any) to pass to AI as senderName
    const storedName = sessionContext.getUserName(formattedNumber);
    const senderNameForAI = storedName || formattedNumber;

    const aiResult = await generateReplyFromGemini(message, senderNameForAI, null, { autoSave: false });

    let reply = null;
    if (typeof aiResult === 'string') reply = aiResult;
    else if (typeof aiResult === 'object') reply = aiResult.reply || aiResult.deskripsi || null;

    if (reply) {
      await sendWhatsAppMessage(formattedNumber, reply);
      return res.status(200).json({ success: true, sent: true, reply });
    }

    // AI returned nothing — do not send a fallback message.
    return res.status(200).json({ success: true, sent: false, message: 'No reply from AI' });
  } catch (error) {
    console.error('[WEBHOOK] Error:', error && error.message ? error.message : error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error && error.message ? error.message : String(error) });
  }
};

module.exports = { handleIncomingMessage };