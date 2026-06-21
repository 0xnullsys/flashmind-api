// ponytail: HF Space (Flask) — request JSON, get JSON cards back.
// No Python subprocess needed; pure HTTP works in Vercel serverless.

interface AICard {
  judul: string;
  catatan: string;
  category?: string;
}

// ponytail: lightweight keyword-based category detection; user can edit before save
export function detectCategory(text: string): string | undefined {
  const t = text.toLowerCase();
  if (/\b(sel|membran|organel|dna|rna|enzim|protein|fotosintesis|ekosistem|species)\b/.test(t)) return 'Biologi';
  if (/\b(gaya|energi|listrik|magnet|gelombang|optik|newton|relativitas|kuantum|atom)\b/.test(t)) return 'Fisika';
  if (/\b(reaksi|asam|basa|ikatan|kimia|larutan|mol|ph|oksidasi|reduksi)\b/.test(t)) return 'Kimia';
  if (/\b(aljabar|geometri|kalkulus|persamaan|integral|turunan|matriks|vektor|probabilitas)\b/.test(t)) return 'Matematika';
  if (/\b(grammar|vocabulary|english|tense|verb|noun|pronunciation|writing|speaking)\b/.test(t)) return 'Bahasa Inggris';
  if (/\b(tata bahasa|eyd|puisi|cerpen|novel|indonesia|kata baku|imbuhan|prefiks|sufiks)\b/.test(t)) return 'Bahasa Indonesia';
  if (/\b(perang|kemerdekaan|kerajaan|kolosal|nasionalisme|revolusi|sejarah)\b/.test(t)) return 'Sejarah';
  if (/\b(geografi|iklim|curah hujan|populasi|wilayah|benua|samudra)\b/.test(t)) return 'Geografi';
  if (/\b(pasar|inflasi|permintaan|penawaran|rupiah|saham|ekonomi|perdagangan|gdp|ekspor)\b/.test(t)) return 'Ekonomi';
  if (/\b(javascript|python|react|api|variable|function|class|object|array|loop|database|sql|html|css|typescript)\b/.test(t)) return 'Pemrograman';
  return undefined;
}

export async function generateCards(notes: string, files?: Array<{ buffer: Buffer; mimetype: string; originalname?: string }>): Promise<AICard[]> {
  const provider = process.env.AI_PROVIDER || 'auto';

  // Try HF Space first if provider is auto or hf
  if (provider === 'auto' || provider === 'hf') {
    try {
      const cards = await generateCardsHF(notes, files);
      if (cards.length > 0) return cards;
    } catch (err) {
      console.error('HF Space failed:', err);
      if (provider === 'hf') throw err;
    }
  }

  // Fallback to OpenAI
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

async function generateCardsHF(notes: string, files?: Array<{ buffer: Buffer; mimetype: string; originalname?: string }>): Promise<AICard[]> {
  const url = (process.env.CF_PROXY_URL || 'https://your-worker.workers.dev') + '/v1/cards';
  const form = new FormData();
  if (notes) form.append('note_text', notes);
  // ponytail: forward image files as multipart 'files' field for OCR via HF Space
  if (files && files.length > 0) {
    for (const f of files) {
      // ponytail: cast to any to satisfy BlobPart typing for FormData append
      const blob = new Blob([new Uint8Array(f.buffer)], { type: f.mimetype });
      form.append('files', blob, f.originalname || 'upload.jpg');
    }
  }

  const res = await fetch(url, { method: 'POST', body: form });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HF Space /v1/cards failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { cards?: Array<{ question?: string; answer?: string; judul?: string; catatan?: string }> };
  if (!data.cards || !Array.isArray(data.cards)) {
    throw new Error('HF Space returned unexpected JSON shape');
  }
  // ponytail: detect category from full text so all cards share the same scope
  const sharedCategory = detectCategory(notes + ' ' + (files?.map(f => f.originalname || '').join(' ') || ''));
  return data.cards.map((c) => ({
    judul: c.judul || c.question || 'Kartu',
    catatan: c.catatan || c.answer || '',
    category: sharedCategory,
  })).filter((c) => c.judul || c.catatan);
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

  return normalizeCards(content, notes);
}

function normalizeCards(data: unknown, notes: string = ''): AICard[] {
  let cards: Array<{ judul?: string; catatan?: string; title?: string; notes?: string; front?: string; back?: string }>;

  if (typeof data === 'string') {
    const jsonMatch = data.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      cards = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('AI response tidak valid');
    }
  } else if (Array.isArray(data)) {
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
    category: detectCategory((card.judul || '') + ' ' + (card.catatan || '') + ' ' + notes),
  })).filter((card) => card.judul || card.catatan);
}