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

    const aiResult = await generateReplyFromGemini(message, formattedNumber, null, { autoSave: false });

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
