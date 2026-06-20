// ponytail: HF Space (Docker/Flask) returns .apkg binary.
// We upload text as form-data `note_text`, then download .apkg and
// parse it via Python helper `anki_parse.py` to extract card pairs.

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
  const hfSpaceUrl = process.env.HF_SPACE_ID;
  if (!hfSpaceUrl) {
    throw new Error('HF_SPACE_ID tidak dikonfigurasi');
  }

  // Build multipart form-data (matches the Space's POST /)
  const form = new FormData();
  form.append('note_text', notes);

  const uploadRes = await fetch(hfSpaceUrl, {
    method: 'POST',
    body: form,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => '');
    throw new Error(`HF Space upload failed (${uploadRes.status}): ${text.slice(0, 200)}`);
  }

  const contentType = uploadRes.headers.get('content-type') || '';
  if (!contentType.includes('octet-stream') && !contentType.includes('apkg')) {
    // Space returned HTML/text instead of .apkg (likely an error message)
    const text = await uploadRes.text();
    throw new Error(`HF Space did not return .apkg: ${text.slice(0, 200)}`);
  }

  // Save .apkg to temp file
  const { writeFile, unlink } = await import('fs/promises');
  const { spawn } = await import('child_process');
  const os = await import('os');
  const path = await import('path');

  const tmpDir = os.tmpdir();
  const apkgPath = path.join(tmpDir, `flashmind-${Date.now()}.apkg`);

  const buffer = Buffer.from(await uploadRes.arrayBuffer());
  await writeFile(apkgPath, buffer);

  try {
    // Parse with Python helper
    const pyScript = path.join(process.cwd(), 'server', 'anki_parse.py');
    const result = await runPython(pyScript, [apkgPath]);
    if (result.error) {
      throw new Error(`apkg parse failed: ${result.error}`);
    }
    return result.cards || [];
  } finally {
    await unlink(apkgPath).catch(() => {});
  }
}

import { spawn } from 'child_process';

function runPython(script: string, args: string[]): Promise<{ cards?: AICard[]; error?: string }> {
  return new Promise((resolve) => {
    const py = process.platform === 'win32' ? 'python' : 'python3';
    const child = spawn(py, [script, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (b) => { stdout += b.toString(); });
    child.stderr.on('data', (b) => { stderr += b.toString(); });
    child.on('error', (err) => resolve({ error: `spawn failed: ${err.message}` }));
    child.on('close', (code) => {
      if (code !== 0) {
        resolve({ error: stderr || `python exited ${code}` });
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        resolve({ error: `invalid python output: ${stdout.slice(0, 200)}` });
      }
    });
  });
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
  })).filter((card) => card.judul || card.catatan);
}