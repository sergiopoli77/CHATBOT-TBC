const axios = require('axios');

const FONNTE_API_KEY = process.env.FONNTE_API_KEY; // simpan API key di .env
const FONNTE_URL = 'https://api.fonnte.com/send';

/**
 * Kirim pesan WhatsApp via Fonnte
 * @param {string} phone - Nomor HP tujuan (format internasional, tanpa +)
 * @param {string} message - Isi pesan
 * @returns {Promise<object>} Hasil response dari Fonnte
 */
async function sendWhatsappNotif(phone, message) {
  if (!FONNTE_API_KEY) throw new Error('FONNTE_API_KEY belum di-set di .env');
  if (!phone || !message) throw new Error('Nomor HP dan pesan wajib diisi');
  try {
    const res = await axios({
      method: 'post',
      url: FONNTE_URL,
      headers: {
        'Authorization': FONNTE_API_KEY
      },
      data: {
        target: phone,
        message: message,
        countryCode: '62', // default Indonesia
      }
    });
    return res.data;
  } catch (err) {
    throw err.response ? err.response.data : err;
  }
}

async function downloadMedia(url) {
  if (!FONNTE_API_KEY) {
    // still try without header if API key missing
  }
  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: FONNTE_API_KEY ? { Authorization: FONNTE_API_KEY } : {}
    });
    return { data: Buffer.from(res.data, 'binary'), contentType: res.headers['content-type'] || 'image/jpeg' };
  } catch (err) {
    // bubble up original error to caller
    throw err.response ? err.response.data || err.response : err;
  }
}

module.exports = { sendWhatsappNotif, downloadMedia };
