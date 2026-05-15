import { auth } from "../lib/firebase";

export async function predictPrice(commodity: any) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    
    const idToken = await user.getIdToken();
    const historyData = commodity.history.map((h: any) => h.price).join(", ");
    
    const prompt = `Sebagai analis pasar pertanian cerdas, prediksi harga ${commodity.type} untuk 3 hari ke depan berdasarkan data historis 7 hari terakhir: [${historyData}]. 
    Berikan prediksi dalam format JSON dengan key 'predictions' (array of 3 numbers) dan 'reasoning' (penjelasan singkat dalam Bahasa Indonesia).`;

    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || errorData.error || "Gagal menghubungi asisten AI");
    }

    const data = await response.json();
    // Attempt to parse JSON from response text as the backend returns string
    try {
      const match = data.text.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
      return { reasoning: data.text, predictions: [] };
    } catch (e) {
      return { reasoning: data.text, predictions: [] };
    }
  } catch (error: any) {
    console.error("Error predicting price:", error);
    throw error;
  }
}

export async function getPersonalAdvice(userMessage: string, context: string) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    
    const idToken = await user.getIdToken();

    const prompt = `Anda adalah asisten pribadi cerdas untuk petani di Indonesia (AgriPantau). 
    Context: ${context}
    User: ${userMessage}
    
    INSTRUKSI KHUSUS:
    1. Berikan saran yang praktis, ramah, dan berorientasi pada data pertanian.
    2. Gunakan Bahasa Indonesia yang mudah dimengerti petani.
    3. Gunakan FORMAT MARKDOWN yang jelas.
    - Tutup dengan kesimpulan singkat yang sangat jelas.`;

    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || errorData.error || "Gagal menghubungi asisten AI");
    }

    const data = await response.json();
    return data.text;
  } catch (error: any) {
    console.error("Error getting personal advice:", error);
    throw error;
  }
}
