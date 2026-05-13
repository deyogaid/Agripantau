import { GoogleGenAI, Type } from "@google/genai";
import { CommodityPrice, CommodityType } from "@/src/types";

const systemAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function getAiClient(userApiKey?: string) {
  if (userApiKey && userApiKey.trim().length > 30) {
    return new GoogleGenAI({ apiKey: userApiKey });
  }
  return systemAi;
}

export async function predictPrice(commodity: CommodityPrice, userApiKey?: string) {
  const client = getAiClient(userApiKey);
  const historyData = commodity.history.map(h => h.price).join(", ");
  const prompt = `Sebagai analis pasar pertanian cerdas, prediksi harga ${commodity.type} untuk 3 hari ke depan berdasarkan data historis 7 hari terakhir: [${historyData}]. 
  Berikan prediksi dalam format JSON dengan key 'predictions' (array of 3 numbers) dan 'reasoning' (penjelasan singkat dalam Bahasa Indonesia).`;

  try {
    const response = await client.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            predictions: {
              type: Type.ARRAY,
              items: { type: Type.NUMBER },
              description: "Prediksi harga untuk 3 hari ke depan"
            },
            reasoning: {
              type: Type.STRING,
              description: "Alasan prediksi dalam Bahasa Indonesia"
            }
          },
          required: ["predictions", "reasoning"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error predicting price:", error);
    return null;
  }
}

export async function getPersonalAdvice(userMessage: string, context: string, userApiKey?: string) {
  const client = getAiClient(userApiKey);
  const prompt = `Anda adalah asisten pribadi cerdas untuk petani di Indonesia (AgriPantau). 
  Context: ${context}
  User: ${userMessage}
  
  INSTRUKSI KHUSUS:
  1. Berikan saran yang praktis, ramah, dan berorientasi pada data pertanian.
  2. Gunakan Bahasa Indonesia yang mudah dimengerti petani (hindari istilah teknis yang terlalu rumit).
  3. Gunakan FORMAT MARKDOWN yang sangat jelas:
     - Gunakan bullet points (-) untuk daftar.
     - Gunakan BOLD (**) untuk angka atau poin penting.
     - Gunakan TABEL jika membandingkan data.
     - Berikan spasi antar paragraf agar mudah dibaca oleh orang tua.
     - Tutup dengan kesimpulan singkat yang sangat jelas (contoh: "Jadi, sebaiknya Tunda Jual dulu").`;

  try {
    const response = await client.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt
    });
    return response.text;
  } catch (error) {
    console.error("Error getting personal advice:", error);
    return "Maaf, saya sedang mengalami kendala teknis. Pastikan API Key Anda valid (jika menggunakan custom key).";
  }
}
