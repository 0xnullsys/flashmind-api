import { Client } from '@gradio/client';

interface AICard {
  judul: string;
  catatan: string;
}

export async function generateCards(notes: string): Promise<AICard[]> {
  const provider = process.env.AI_PROVIDER || 'auto';
  
  // Try HF Space first if provider is auto or hf
  if (provider === 'auto' || provider === 'hf') {
    try {
      const cards = await generateCardsHF(notes);
      if (cards.length > 0) return cards;
    } catch (err) {
      console.error('HF Space failed:', err);
      if (provider === 'hf') throw err;
    }
  }

  // Fallback to OpenAI if provider is auto or openai
  if ((provider === 'auto' || provider === 'openai') && process.env.OPENAI_API_KEY) {
    try {
      const cards = await generateCardsOpenAI(notes);
      if (cards.length > 0) return cards;
    } catch (err) {
      console.error('OpenAI fallback failed:', err);
      throw err;
    }
  }

  throw new Error('AI tidak tersedia');
}

async function generateCardsHF(notes: string): Promise<AICard[]> {
  const hfSpaceId = process.env.HF_SPACE_ID;
  if (!hfSpaceId) {
    throw new Error('HF_SPACE_ID tidak dikonfigurasi');
  }

  const client = await Client.connect(hfSpaceId);
  const result = await client.predict('/predict', {
    text: notes,
  });

  const data = result.data;
  if (!data) throw new Error('HF Space returned no data');

  return normalizeCards(data);
}

async function generateCardsOpenAI(notes: string): Promise<AICard[]> {
  const { default: OpenAI } = await import('openai');

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a flashcard generator. Convert the given notes into flashcards. Each card should have a "judul" (front/title) and "catatan" (back/notes). Return ONLY valid JSON array: [{"judul": "...", "catatan": "..."}]',
      },
      { role: 'user', content: notes },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned empty response');

  return normalizeCards(content);
}

function normalizeCards(data: unknown): AICard[] {
  let cards: Array<{ judul?: string; catatan?: string; title?: string; notes?: string; front?: string; back?: string }>;

  if (typeof data === 'string') {
    // Try to parse as JSON
    const jsonMatch = data.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      cards = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('AI response tidak valid');
    }
  } else if (Array.isArray(data)) {
    // If it's an array of arrays, map them
    if (data.length > 0 && Array.isArray(data[0])) {
      cards = data.map((item: unknown[]) => ({
        judul: String(item[0] || ''),
        catatan: String(item[1] || ''),
      }));
    } else {
      cards = data as any[];
    }
  } else {
    throw new Error('Format AI response tidak dikenal');
  }

  return cards.map((card) => ({
    judul: card.judul || card.title || card.front || 'Kartu',
    catatan: card.catatan || card.notes || card.back || '',
  })).filter((card) => card.judul || card.catatan);
}