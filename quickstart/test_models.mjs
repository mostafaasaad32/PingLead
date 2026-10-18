import fs from 'fs';
const key = process.env.GEMINI_API_KEY || '';

async function testModel(model) {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Return JSON: {"status": "ok"}' }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });
    console.log(`${model} -> Status ${res.status}:`, (await res.text()).slice(0, 200));
    return res.status === 200;
  } catch (e) {
    console.error(`${model} -> Error:`, e.message);
    return false;
  }
}

async function run() {
  const models = [
    'models/gemini-2.5-flash-lite',
    'models/gemini-flash-latest',
    'models/gemini-3.5-flash',
    'models/gemini-3.8-flash'
  ];
  for (const m of models) {
    const ok = await testModel(m);
    if (ok) break;
  }
}
run();
