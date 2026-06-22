// Loads questions.json (served from /public) and groups it by category into the
// shape the game engine uses internally.
//
// questions.json schema (per question):
//   { id, category, question, bounded, answers: [{ text, score, note }] }
//
// Internal bank shape:
//   [ { cat, questions: [ { id, q, ans: [{ a, s, note }] } ] } ]

export function groupByCategory(questions) {
  const order = [];
  const byCat = new Map();
  for (const item of questions) {
    if (!byCat.has(item.category)) {
      byCat.set(item.category, []);
      order.push(item.category);
    }
    byCat.get(item.category).push({
      id: item.id,
      q: item.question,
      bounded: item.bounded !== false,
      ans: (item.answers || []).map((a) => ({
        a: a.text,
        s: a.score,
        note: a.note || '',
      })),
    });
  }
  return order.map((cat) => ({ cat, questions: byCat.get(cat) }));
}

export async function loadBank() {
  const res = await fetch(`${import.meta.env.BASE_URL}questions.json`);
  if (!res.ok) throw new Error('تعذّر تحميل بنك الأسئلة');
  const data = await res.json();
  return groupByCategory(data);
}
