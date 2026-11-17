// Vercel serverless function: POST /api/parse
// Uses Claude to understand sentences the local parser is unsure about.
// Set ANTHROPIC_API_KEY in your Vercel project settings (never in the frontend code).
// Optional: ANTHROPIC_MODEL (defaults to a fast, low-cost model).

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';

const SYSTEM = `You turn short money notes from Nigerians (English, Nigerian Pidgin, or a mix) into JSON for a budgeting app.

Return ONLY a JSON object, no other text:
{
  "intent": "expense" | "income" | "plan" | "vault_in" | "vault_out" | "question" | "undo" | "edit_last" | "unknown",
  "items": [ { "amount": number (whole naira), "potId": string (one of the pot ids given) or null, "note": short string, "date": "YYYY-MM-DD" } ],
  "question": { "potId": string or null, "kind": "remaining" | "spent" | "summary", "range": "today" | "week" | "period" } (only for questions),
  "warnings": [ short strings in simple Pidgin about anything the user should double-check ]
}

Rules:
- "k" means thousand (2k = 2000, 1.5k = 1500), "m" means million. Spoken numbers count too ("fifty thousand").
- expense: money spent ("I chop 1500", "I enter keke 800", "I pay light bill"). One item per thing bought.
- income: money received ("salary don land", "dem pay me", "I collect 70k"). If someone says salary of "200" with no "k", it means 200,000: add a warning.
- plan: setting budget amounts per pot ("put 20k for data, 60k for transport").
- vault_in / vault_out: putting money into or taking money out of savings.
- question: asking what remains or how much was spent ("wetin remain for feeding?"). items must be [].
- undo: cancel or delete the last entry. edit_last: change the last entry's amount ("change am to 3k").
- Pick the potId whose name or keywords fit best. Common words: chop/mama put/buka = food; keke/okada/danfo/BRT/Bolt/fuel = transport; recharge/airtime/data = data; NEPA/light/prepaid/gen diesel = power; offering/tithe = giving; send mama/black tax/school fees = family; owambe/shayo/outing = enjoyment.
- "yesterday" = the day before today. Default date is today. Never use a future date.
- Never invent an amount that was not said. If unclear, use "unknown".`;

interface Req { method?: string; body?: unknown }
interface Res { status(code: number): Res; json(data: unknown): void; setHeader(k: string, v: string): void }

export default async function handler(req: Req, res: Res) {
  res.setHeader('Cache-Control', 'no-store');
  const key = process.env.ANTHROPIC_API_KEY;

  if (req.method === 'GET') {
    res.status(200).json({ ok: Boolean(key) });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!key) {
    res.status(503).json({ error: 'AI is not configured' });
    return;
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as {
    text?: string; today?: string; pots?: { id: string; name: string; keywords?: string[] }[];
  };
  const text = String(body?.text ?? '').slice(0, 500);
  if (!text.trim()) {
    res.status(400).json({ error: 'No text' });
    return;
  }
  const pots = (body.pots ?? []).slice(0, 30).map((p) => `${p.id} (${p.name}${p.keywords?.length ? ': ' + p.keywords.slice(0, 12).join(', ') : ''})`);

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        system: SYSTEM,
        messages: [{
          role: 'user',
          content: `Today is ${body.today}.\nPots:\n${pots.join('\n')}\n\nNote: "${text}"`,
        }],
      }),
    });
    if (!r.ok) {
      res.status(502).json({ error: `Claude API error ${r.status}` });
      return;
    }
    const data = (await r.json()) as { content?: { type: string; text?: string }[] };
    const out = data.content?.find((c) => c.type === 'text')?.text ?? '';
    const json = out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1);
    res.status(200).json(JSON.parse(json));
  } catch {
    res.status(500).json({ error: 'Could not understand' });
  }
}
