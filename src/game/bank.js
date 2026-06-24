// Loads questions.json (served from /public) and builds the internal bank.
//
// questions.json schema:
//   {
//     "categories": [ { "id", "name" } ],          // the approved fixed list
//     "questions":  [ { id, category, question, bounded, answers:[{text,score,note}] } ]
//   }
//
// The 8 approved categories are AUTHORITATIVE: the bank always contains all of
// them, in order, even when a category has no questions yet (questions arrive in
// separate batches). Questions whose `category` is not in the approved list are
// ignored (with a warning) — categories are never inferred from question data.
//
// Internal bank shape:
//   [ { id, cat, questions: [ { id, q, bounded, ans: [{ a, s, note }] } ] } ]

export function buildBank(data) {
  const categories = Array.isArray(data?.categories) ? data.categories : [];
  const questions = Array.isArray(data?.questions) ? data.questions : [];

  const byName = new Map(categories.map((c) => [c.name, []]));
  for (const item of questions) {
    if (!byName.has(item.category)) {
      // eslint-disable-next-line no-console
      console.warn(`[صِفر] سؤال بفئة غير معتمدة، سيُتجاهل: "${item.category}" (${item.id})`);
      continue;
    }
    byName.get(item.category).push({
      id: item.id,
      q: item.question,
      bounded: item.bounded !== false,
      ans: (item.answers || []).map((a) => ({ a: a.text, s: a.score, note: a.note || '' })),
    });
  }

  return categories.map((c) => ({
    id: c.id,
    cat: c.name,
    questions: byName.get(c.name),
  }));
}

export async function loadBank() {
  const res = await fetch(`${import.meta.env.BASE_URL}questions.json`);
  if (!res.ok) throw new Error('تعذّر تحميل بنك الأسئلة');
  const data = await res.json();
  return buildBank(data);
}
