const { GoogleGenAI } = require('@google/genai');
const { loadData } = require('./data');

async function generateNoteName(content) {
  const data = loadData();
  const apiKey = data.aiSettings?.apiKey;

  if (!apiKey) {
    // Fallback: timestamp-based name
    return `Note ${new Date().toISOString().slice(0, 10)}`;
  }

  try {
    const genAI = new GoogleGenAI({ apiKey });
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [{
          text: `Generate a concise, descriptive title (2-5 words) for this note. Return ONLY the title, nothing else:\n\n${content.substring(0, 500)}`
        }]
      }]
    });

    const title = response.text?.trim();
    if (title) {
      // Clean up the title - remove quotes if present
      return title.replace(/^["']|["']$/g, '');
    }
    return `Note ${new Date().toISOString().slice(0, 10)}`;
  } catch (err) {
    // Fallback on any error
    return `Note ${new Date().toISOString().slice(0, 10)}`;
  }
}

module.exports = { generateNoteName };
