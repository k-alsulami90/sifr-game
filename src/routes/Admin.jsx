import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { loadBank } from '../game/bank.js';
import GameController from '../game/controller.js';
import { createRoom, writeRoom, gen4 } from '../hooks/useRoom.js';
import { firebaseReady } from '../firebase.js';
import { toAr, cumTotal, roundTotal } from '../game/scoring.js';
import { GOLD_GRAD, C } from '../theme.js';

function useIsWide(bp = 880) {
  const [wide, setWide] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= bp : true
  );
  useEffect(() => {
    const f = () => setWide(window.innerWidth >= bp);
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, [bp]);
  return wide;
}

export default function Admin() {
  const [params, setParams] = useSearchParams();
  const code = params.get('room');
  const [bank, setBank] = useState(null);
  const [bankErr, setBankErr] = useState(null);
  const ctrlRef = useRef(null);
  const [snap, setSnap] = useState(null);
  const creatingRef = useRef(false);
  const wide = useIsWide();
  const [confirmReset, setConfirmReset] = useState(false);
  const resetTimer = useRef(null);

  // load question bank
  useEffect(() => {
    loadBank().then(setBank).catch((e) => setBankErr(e.message));
  }, []);

  // init engine once the bank is ready
  useEffect(() => {
    if (!bank) return;
    const ctrl = new GameController(bank, (st) => setSnap({ ...st }));
    ctrlRef.current = ctrl;
    setSnap({ ...ctrl.state });
    return () => ctrl.destroy();
  }, [bank]);

  // make sure we have a room code
  useEffect(() => {
    if (!bank || !ctrlRef.current || code) return;
    if (!firebaseReady) {
      setParams({ room: gen4() }, { replace: true });
      return;
    }
    if (creatingRef.current) return;
    creatingRef.current = true;
    createRoom(ctrlRef.current.toRoom()).then((c) =>
      setParams({ room: c }, { replace: true })
    );
  }, [bank, code, setParams]);

  // mirror every state change into Firebase for the Display screen
  useEffect(() => {
    if (!code || !snap || !ctrlRef.current) return;
    writeRoom(code, ctrlRef.current.toRoom());
  }, [snap, code]);

  if (bankErr)
    return <Center title="خطأ" body={bankErr} />;
  if (!bank || !snap)
    return <Center title="جارٍ التحميل…" body="يتم تجهيز بنك الأسئلة" />;

  const ctrl = ctrlRef.current;
  const s = snap;
  const phase = s.turnPhase;
  const playing = s.status === 'playing';
  const inElim = phase === 'elimination';
  const aSetup = s.status === 'setup';
  const aPlaying = playing && !inElim;
  const aElim = playing && inElim;
  const aWinner = s.status === 'game_over';

  return (
    <div dir="rtl" lang="ar" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: C.panelDark, overflow: 'hidden' }}>
      {/* header */}
      <div style={{ flex: 'none', height: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', background: C.chrome, borderBottom: '1px solid rgba(245,200,75,.12)', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: "'Cairo'", fontWeight: 900, fontSize: 20, background: 'linear-gradient(180deg,#FFE49A,#F5C84B 60%,#C9962A)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>صِفر</span>
          <span style={{ fontSize: 10, color: C.mute2, letterSpacing: 2, fontWeight: 700 }}>لوحة التحكّم</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 8, background: 'rgba(245,200,75,.12)', border: '1px solid rgba(245,200,75,.3)', color: C.goldSoft, fontSize: 12, fontWeight: 700 }}>
            الغرفة
            <b style={{ fontFamily: "'Cairo'", fontWeight: 900, fontSize: 16, letterSpacing: 3 }}>{code ? toAr(code) : '…'}</b>
          </span>
          <a href={code ? `${import.meta.env.BASE_URL}display?room=${code}` : '#'} target="_blank" rel="noreferrer" style={{ height: 32, display: 'inline-flex', alignItems: 'center', padding: '0 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: C.panel2, color: C.mute6, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
            📺 العرض
          </a>
          <button
            onClick={() => {
              if (confirmReset) {
                if (resetTimer.current) clearTimeout(resetTimer.current);
                setConfirmReset(false);
                ctrl.onReset();
              } else {
                setConfirmReset(true);
                resetTimer.current = setTimeout(() => setConfirmReset(false), 4000);
              }
            }}
            title={confirmReset ? 'اضغط للتأكيد — ستُمسح الجلسة' : 'إعادة الجلسة من البداية'}
            style={{ height: 32, padding: '0 12px', borderRadius: 8, border: confirmReset ? '1px solid rgba(255,90,90,.6)' : '1px solid rgba(255,90,90,.25)', background: confirmReset ? 'rgba(255,90,90,.18)' : 'rgba(255,90,90,.08)', color: C.danger3, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            {confirmReset ? 'متأكد؟ إعادة' : '↺ إعادة'}
          </button>
        </div>
      </div>

      {!firebaseReady && (
        <div style={{ flex: 'none', padding: '8px 14px', background: 'rgba(255,90,90,.1)', borderBottom: '1px solid rgba(255,90,90,.25)', color: C.danger3, fontSize: 12, fontWeight: 700, textAlign: 'center' }}>
          ⚠️ بدون إعداد Firebase لن تتزامن شاشة العرض. راجع README — يمكنك تجربة لوحة التحكّم محليًّا.
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {aSetup && <SetupView ctrl={ctrl} s={s} bank={bank} />}
        {aPlaying && <InGameView ctrl={ctrl} s={s} wide={wide} />}
        {aElim && <ElimView ctrl={ctrl} s={s} />}
        {aWinner && <WinnerView ctrl={ctrl} s={s} />}
      </div>
    </div>
  );
}

/* ----------------------------- SETUP ----------------------------- */
function SetupView({ ctrl, s, bank }) {
  const readyCount = bank.filter((c) => c.questions.length > 0).length;
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 14, padding: 14, overflowY: 'auto' }}>
      <div style={card({ borderColor: 'rgba(245,200,75,.16)' })}>
        <div style={{ fontFamily: "'Cairo'", fontWeight: 900, fontSize: 20, color: C.cream }}>إعداد الجلسة</div>
        <div style={{ fontSize: 13, color: C.mute, marginTop: 2 }}>اضبط الفرق وفئاتها المضمونة، ثم ابدأ اللعبة</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: "'Cairo'", fontWeight: 700, fontSize: 14, color: C.mute6 }}>عدد الفرق</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => ctrl.rebuildTeams(s.numTeams - 1)} style={stepBtn}>−</button>
            <span style={{ fontFamily: "'Cairo'", fontWeight: 900, fontSize: 28, color: C.gold, width: 34, textAlign: 'center' }}>{toAr(s.numTeams)}</span>
            <button onClick={() => ctrl.rebuildTeams(s.numTeams + 1)} style={stepBtn}>+</button>
          </div>
          <span style={{ marginRight: 'auto', fontSize: 13, color: C.mute, fontWeight: 700 }}>
            عدد الجولات حتى الفوز: <span style={{ color: C.goldSoft, fontFamily: "'Cairo'", fontWeight: 900 }}>{toAr(Math.max(1, s.numTeams - 1))}</span>
          </span>
        </div>
      </div>

      <div style={card()}>
        <div style={{ fontFamily: "'Cairo'", fontWeight: 700, fontSize: 15, color: C.cream, marginBottom: 4 }}>الفرق وفئاتها المضمونة</div>
        <div style={{ fontSize: 12, color: C.mute, marginBottom: 14 }}>كل فريق يختار فئة واحدة تظهر حتمًا في الجلسة. الباقي يُسحب عشوائيًا.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {s.teams.map((t, i) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: C.panel2, border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: '10px 14px' }}>
              <span style={{ width: 14, height: 14, borderRadius: '50%', background: t.dot, flex: 'none' }} />
              <input value={t.name} onChange={(e) => ctrl.setName(t.id, e.target.value)} placeholder="ادخل اسم الفريق" style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,.12)', color: C.cream2, fontFamily: "'Cairo'", fontWeight: 700, fontSize: 16, padding: '4px 2px', outline: 'none' }} />
              <div style={{ position: 'relative', flex: 'none' }}>
                <select
                  value={s.safePicks[i]}
                  onChange={(e) => ctrl.setSafe(i, Number(e.target.value))}
                  title="الفئة المضمونة لهذا الفريق"
                  style={{ appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', background: C.inputBg, color: C.goldSoft, border: '1px solid rgba(245,200,75,.4)', borderRadius: 100, padding: '8px 14px 8px 30px', fontFamily: "'Tajawal'", fontWeight: 700, fontSize: 13, cursor: 'pointer', outline: 'none', maxWidth: 180, textOverflow: 'ellipsis' }}
                >
                  {bank.map((c, ci) => {
                    const empty = c.questions.length === 0;
                    return (
                      <option key={ci} value={ci} disabled={empty} style={{ background: C.panel, color: empty ? '#6b6557' : C.cream2 }}>
                        {c.cat}{empty ? ' · قريباً' : ` · ${toAr(c.questions.length)}`}
                      </option>
                    );
                  })}
                </select>
                <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: C.goldSoft, fontSize: 10 }}>▾</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button onClick={ctrl.startGame} disabled={readyCount === 0} style={{ flex: 'none', padding: 18, borderRadius: 14, border: 'none', background: readyCount === 0 ? '#2a2a32' : GOLD_GRAD, color: readyCount === 0 ? '#6b6557' : '#2a2008', fontFamily: "'Cairo'", fontWeight: 900, fontSize: 20, cursor: readyCount === 0 ? 'not-allowed' : 'pointer', boxShadow: readyCount === 0 ? 'none' : '0 10px 30px rgba(245,200,75,.32)' }}>▶ بدء اللعبة</button>
    </div>
  );
}

/* ----------------------------- IN-GAME ----------------------------- */
function InGameView({ ctrl, s, wide }) {
  const phase = s.turnPhase;
  const showSpin = phase === 'spin';
  const showQuestion = phase === 'question';
  const showCountdown = phase === 'countdown';
  const showReveal = phase === 'reveal';
  const adminWaiting = showSpin || showCountdown;
  const answering = s.turnOrder[s.answeringPos];
  const teamName = (id) => s.teams.find((t) => t.id === id)?.name || '';

  // reveals across the WHOLE round (both passes) — same question, no reuse
  const revsRound = s.log.filter(
    (e) => e.round === s.currentRound && ['scored', 'pointless', 'wrong'].includes(e.outcome)
  );
  // reveals in the current pass only — drives the turn-order list
  const revs = revsRound.filter((e) => e.pass === s.currentPass);
  const used = revsRound.map((r) => r.answer);
  const usedAnswers = revsRound.filter((e) => e.outcome !== 'wrong');
  const curAnswers = s.currentQuestion?.answers || [];
  const filter = (s.entryAnswer || '').trim();
  const suggestions = curAnswers.filter((a) => !used.includes(a.text) && (!filter || a.text.includes(filter)));

  const lr = s.lastReveal || {};
  const revealResultText =
    lr.outcome === 'wrong' ? 'إجابة خاطئة' : lr.outcome === 'pointless' ? 'صِفر — نادرة!' : 'نُدرة ' + toAr(s.targetScore ?? 0);
  const continueLabel =
    s.answeringPos + 1 < s.turnOrder.length ? 'الفريق التالي ←' : s.currentPass === 1 ? 'الدور الثاني ←' : 'نتيجة الجولة ←';

  // reveal needs an answer or an explicit score; otherwise use the صفر/خطأ buttons
  const canReveal = (s.entryAnswer || '').trim() !== '' || String(s.entryScore ?? '').trim() !== '';
  const revealIfReady = () => { if (canReveal) ctrl.onReveal(); };

  const sbOrder = s.teams.map((t) => t.id).sort((a, b) => cumTotal(s.log, a) - cumTotal(s.log, b));

  return (
    <div style={{ height: '100%', display: 'grid', gridTemplateColumns: wide ? '1fr 360px' : '1fr', gap: 14, padding: 14, overflowY: wide ? 'hidden' : 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, gap: 14, overflowY: wide ? 'auto' : 'visible' }}>
        {/* question + timer */}
        <div style={card({ borderColor: 'rgba(245,200,75,.16)' })}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontFamily: "'Cairo'", fontWeight: 700, fontSize: 13, color: C.goldSoft }}>الجولة {toAr(s.currentRound)} · الدور {toAr(s.currentPass)} من ٢</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: "'Cairo'", fontWeight: 900, fontSize: 30, color: C.gold, lineHeight: 1 }}>{toAr(s.timer)}</span>
              <span style={{ fontSize: 11, color: C.mute, fontWeight: 700 }}>ثانية</span>
            </div>
          </div>
          <span style={{ display: 'inline-block', padding: '5px 14px', borderRadius: 100, background: 'rgba(245,200,75,.14)', color: C.goldSoft, fontFamily: "'Cairo'", fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{s.currentQuestion?.category || '…'}</span>
          <div style={{ fontFamily: "'Cairo'", fontWeight: 900, fontSize: 24, lineHeight: 1.3, color: C.cream2 }}>{s.currentQuestion?.question || '…'}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={ctrl.startTimer} style={{ flex: 1, padding: 11, borderRadius: 9, border: 'none', background: C.gold, color: '#2a2008', fontFamily: "'Cairo'", fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>ابدأ المؤقّت</button>
            <button onClick={ctrl.pauseTimer} style={ghostBtn}>إيقاف</button>
            <button onClick={ctrl.resetTimer} style={ghostBtn}>تصفير</button>
          </div>
        </div>

        {/* spin / countdown banner */}
        {adminWaiting && (
          <div style={{ flex: 'none', background: C.panel, border: '1px dashed rgba(245,200,75,.3)', borderRadius: 14, padding: 22, textAlign: 'center' }}>
            <div style={{ fontFamily: "'Cairo'", fontWeight: 700, fontSize: 16, color: C.goldSoft }}>
              {showSpin ? 'جارٍ اختيار الفئة على الشاشة…' : 'العدّ التنازلي جارٍ على الشاشة…'}
            </div>
            <div style={{ fontSize: 13, color: C.mute, marginTop: 4 }}>تابع شاشة العرض</div>
          </div>
        )}

        {/* reveal continue */}
        {showReveal && (
          <div style={{ flex: 'none', background: C.panel, border: '1px solid rgba(245,200,75,.2)', borderRadius: 14, padding: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontFamily: "'Cairo'", fontWeight: 900, fontSize: 18, color: C.cream2 }}>{teamName(lr.teamId)} · {revealResultText}</div>
              <div style={{ fontSize: 13, color: C.mute }}>ظهرت النتيجة على الشاشة</div>
            </div>
            <div style={{ flex: 'none', display: 'flex', gap: 8 }}>
              <button onClick={ctrl.editLastReveal} title="تراجع عن آخر كشف وأعد الإدخال" style={{ minHeight: 44, padding: '13px 18px', borderRadius: 11, border: '1px solid rgba(255,255,255,.15)', background: C.panel2, color: C.mute6, fontFamily: "'Cairo'", fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>↩ تعديل</button>
              <button onClick={ctrl.onContinue} style={{ minHeight: 44, padding: '13px 26px', borderRadius: 11, border: 'none', background: GOLD_GRAD, color: '#2a2008', fontFamily: "'Cairo'", fontWeight: 900, fontSize: 16, cursor: 'pointer' }}>{continueLabel}</button>
            </div>
          </div>
        )}

        {/* answer entry */}
        {showQuestion && (
          <div style={{ flex: 'none', background: 'linear-gradient(180deg,rgba(245,200,75,.07),rgba(245,200,75,.02))', border: '1px solid rgba(245,200,75,.28)', borderRadius: 14, padding: 18 }}>
            <div style={{ fontFamily: "'Cairo'", fontWeight: 700, fontSize: 15, color: C.goldSoft, marginBottom: 2 }}>دور: {teamName(answering)}</div>
            <div style={{ fontSize: 12, color: C.mute3, marginBottom: 12 }}>ابحث عن الإجابة المنطوقة أو اضبط النقاط يدويًا</div>
            <input value={s.entryAnswer} onChange={(e) => ctrl.setEntryAnswer(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && revealIfReady()} placeholder="اكتب للبحث في بنك الإجابات…" style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: C.inputBg, color: C.cream, fontSize: 15, marginBottom: 10 }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14, minHeight: 8 }}>
              {suggestions.map((a, i) => (
                <button key={i} onClick={() => ctrl.pickSuggestion(a.text, a.score)} title={a.note} style={{ padding: '8px 13px', borderRadius: 100, cursor: 'pointer', fontFamily: "'Tajawal'", fontWeight: 700, fontSize: 13, border: '1px solid rgba(255,255,255,.12)', background: a.score === 0 ? 'rgba(245,200,75,.14)' : C.panel2, color: a.score === 0 ? C.goldSoft : C.mute6 }}>
                  {a.text} · {toAr(a.score)}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: 'none', width: 130 }}>
                <div style={{ fontSize: 11, color: C.mute, fontWeight: 700, marginBottom: 5 }}>النقاط (يدوي ٠–١٠٠)</div>
                <input value={s.entryScore} onChange={(e) => ctrl.setEntryScore(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && revealIfReady()} inputMode="numeric" placeholder="٠٠" style={{ width: '100%', padding: 11, borderRadius: 10, border: '1px solid rgba(245,200,75,.3)', background: C.inputBg, color: C.gold, fontFamily: "'Cairo'", fontWeight: 900, fontSize: 22, textAlign: 'center' }} />
              </div>
              <button onClick={revealIfReady} disabled={!canReveal} title={canReveal ? '' : 'أدخل إجابة أو نقاطًا أولاً (أو استخدم صفر/خطأ)'} style={{ flex: 1, minHeight: 44, padding: 15, borderRadius: 12, border: 'none', background: canReveal ? GOLD_GRAD : '#2a2a32', color: canReveal ? '#2a2008' : '#6b6557', fontFamily: "'Cairo'", fontWeight: 900, fontSize: 17, cursor: canReveal ? 'pointer' : 'not-allowed', boxShadow: canReveal ? '0 8px 24px rgba(245,200,75,.3)' : 'none' }}>▶ كشف النتيجة</button>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button onClick={ctrl.quickPointless} style={{ flex: 1, padding: 13, borderRadius: 11, border: '1px solid rgba(245,200,75,.45)', background: 'rgba(245,200,75,.14)', color: C.goldSoft, fontFamily: "'Cairo'", fontWeight: 900, fontSize: 14, cursor: 'pointer' }}>صفر! — إجابة نادرة غير موجودة</button>
              <button onClick={ctrl.quickWrong} style={{ flex: 1, padding: 13, borderRadius: 11, border: '1px solid rgba(255,90,90,.4)', background: 'rgba(255,90,90,.12)', color: C.danger3, fontFamily: "'Cairo'", fontWeight: 900, fontSize: 14, cursor: 'pointer' }}>خطأ / انتهى الوقت</button>
            </div>
            {usedAnswers.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.08)' }}>
                <div style={{ fontSize: 11, color: C.mute, fontWeight: 700, marginBottom: 7 }}>الإجابات المستخدمة في الجولة (لا تُعاد)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {usedAnswers.map((u, i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 100, background: C.inputBg, border: '1px solid rgba(255,255,255,.08)', fontSize: 12, color: C.mute6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.teams.find((t) => t.id === u.teamId)?.dot || '#888' }} />
                      {u.answer} · <b style={{ fontFamily: "'Cairo'", fontWeight: 900, color: u.score === 0 ? C.goldSoft : C.mute5 }}>{toAr(u.score)}</b>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* team sequence + used answers */}
        <div style={card()}>
          <div style={{ fontFamily: "'Cairo'", fontWeight: 700, fontSize: 14, color: C.cream, marginBottom: 4 }}>ترتيب الإجابة في هذا الدور</div>
          <div style={{ fontSize: 12, color: C.mute, marginBottom: 12 }}>{s.currentPass === 2 ? 'ترتيب معكوس لهذا الدور' : 'الترتيب الأساسي'} · لا يُعاد استخدام إجابة</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {s.turnOrder.map((ti, pos) => {
              const rev = revs.find((r) => r.teamId === ti);
              let badgeText = 'بالانتظار', bg = 'rgba(255,255,255,.07)', col = C.mute3, ans = '';
              if (rev) {
                badgeText = rev.outcome === 'wrong' ? 'خطأ' : toAr(rev.score);
                bg = rev.outcome === 'wrong' ? 'rgba(255,90,90,.16)' : 'rgba(245,200,75,.16)';
                col = rev.outcome === 'wrong' ? C.danger3 : C.goldSoft;
                ans = rev.answer;
              } else if (pos === s.answeringPos) {
                badgeText = 'الآن'; bg = 'rgba(111,168,255,.18)'; col = C.turn2;
              }
              const cur = pos === s.answeringPos && !rev;
              return (
                <div key={ti} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '11px 13px', borderRadius: 10, border: cur ? '1px solid rgba(111,168,255,.45)' : '1px solid rgba(255,255,255,.06)', background: cur ? 'rgba(111,168,255,.08)' : C.panel2 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: "'Cairo'", fontWeight: 900, fontSize: 13, color: C.mute2, width: 18 }}>{toAr(pos + 1)}</span>
                    <span style={{ width: 11, height: 11, borderRadius: '50%', background: s.teams.find((t) => t.id === ti)?.dot }} />
                    <span style={{ fontFamily: "'Cairo'", fontWeight: 700, fontSize: 15, color: C.cream2 }}>{teamName(ti)}</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: C.mute3 }}>{ans}</span>
                    <span style={{ padding: '4px 11px', borderRadius: 100, fontFamily: "'Cairo'", fontWeight: 700, fontSize: 12, background: bg, color: col }}>{badgeText}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* scoreboard col */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: wide ? 'auto' : 'visible' }}>
        <div style={card()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontFamily: "'Cairo'", fontWeight: 700, fontSize: 15, color: C.cream }}>المجموع التراكمي</div>
            <span style={{ fontSize: 12, color: C.goldSoft, fontWeight: 700 }}>الجولة {toAr(s.currentRound)}</span>
          </div>
          <div style={{ fontSize: 11, color: C.mute, marginBottom: 12 }}>الأقل نقاطًا أفضل · الأعلى في الجولة يُقصى</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sbOrder.map((id) => {
              const t = s.teams.find((x) => x.id === id);
              const elim = s.eliminated.includes(id);
              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10, background: elim ? 'rgba(255,255,255,.02)' : C.panel2, border: '1px solid rgba(255,255,255,.06)', opacity: elim ? 0.6 : 1 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 11, height: 11, borderRadius: '50%', background: t?.dot }} />
                    <span style={{ fontFamily: "'Cairo'", fontWeight: 700, fontSize: 15, color: elim ? '#5a5650' : C.cream2, textDecoration: elim ? 'line-through' : 'none' }}>{t?.name}</span>
                    {elim && <span style={{ padding: '2px 9px', borderRadius: 100, background: 'rgba(255,90,90,.14)', color: C.danger3, fontSize: 11, fontWeight: 700 }}>مُقصى</span>}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {!elim && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button onClick={() => ctrl.manualAdjust(id, -1)} title="إنقاص نقطة" style={miniBtn}>−</button>
                        <button onClick={() => ctrl.manualAdjust(id, 1)} title="زيادة نقطة" style={miniBtn}>+</button>
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: C.mute2 }}>جولة {toAr(roundTotal(s.log, id, s.currentRound))}</span>
                    <span style={{ fontFamily: "'Cairo'", fontWeight: 900, fontSize: 22, color: elim ? '#5a5650' : C.goldSoft }}>{toAr(cumTotal(s.log, id))}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- ELIMINATION / SUMMARY ----------------------------- */
function ElimView({ ctrl, s }) {
  const tie = s.eliminatedThisRound == null && (s.tieCandidates || []).length > 0;
  const active = s.teams.map((t) => t.id).filter((id) => !s.eliminated.includes(id));
  const rows = active
    .map((id) => ({ id, total: roundTotal(s.log, id, s.currentRound) }))
    .sort((a, b) => b.total - a.total);
  const remainingAfter = s.teams.map((t) => t.id).filter((id) => !s.eliminated.includes(id) && id !== s.eliminatedThisRound);
  const advanceLabel = remainingAfter.length <= 1 ? 'إعلان البطل ←' : 'الجولة التالية ←';
  const teamName = (id) => s.teams.find((t) => t.id === id)?.name || '';

  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, overflowY: 'auto' }}>
      <div style={{ width: 'min(560px,100%)', background: C.panel, border: '1px solid rgba(255,90,90,.25)', borderRadius: 16, padding: 24 }}>
        <div style={{ fontFamily: "'Cairo'", fontWeight: 900, fontSize: 20, color: C.cream }}>ملخّص الجولة {toAr(s.currentRound)}</div>
        <div style={{ fontSize: 13, color: C.mute, marginTop: 2, marginBottom: 18 }}>مجموع كل فريق في هذه الجولة — الأعلى يُقصى</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {rows.map((r) => {
            const isElim = r.id === s.eliminatedThisRound;
            const isTie = tie && s.tieCandidates.includes(r.id);
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 10, background: isElim ? 'rgba(255,90,90,.07)' : C.panel2, border: isElim ? '1px solid rgba(255,90,90,.25)' : '1px solid rgba(255,255,255,.06)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: s.teams.find((t) => t.id === r.id)?.dot }} />
                  <span style={{ fontFamily: "'Cairo'", fontWeight: 700, fontSize: 16, color: C.cream2 }}>{teamName(r.id)}</span>
                  {isElim && <span style={{ padding: '2px 10px', borderRadius: 100, background: 'rgba(255,90,90,.16)', color: C.danger3, fontSize: 12, fontWeight: 700 }}>يُقصى</span>}
                  {isTie && (
                    <button onClick={() => ctrl.resolveTie(r.id)} style={{ padding: '4px 12px', borderRadius: 100, border: '1px solid rgba(255,90,90,.5)', background: 'rgba(255,90,90,.12)', color: C.danger3, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>أقصِ هذا الفريق</button>
                  )}
                </span>
                <span style={{ fontFamily: "'Cairo'", fontWeight: 900, fontSize: 22, color: isElim ? C.danger2 : C.cream2 }}>{toAr(r.total)}</span>
              </div>
            );
          })}
        </div>
        {tie && <div style={{ marginTop: 14, color: C.danger3, fontSize: 13, fontWeight: 700, textAlign: 'center' }}>تعادل في الأعلى — اختر الفريق المُقصى</div>}
        <button onClick={ctrl.onAdvance} disabled={tie} style={{ marginTop: 20, width: '100%', padding: 15, borderRadius: 12, border: 'none', background: tie ? '#2a2a32' : GOLD_GRAD, color: tie ? '#6b6557' : '#2a2008', fontFamily: "'Cairo'", fontWeight: 900, fontSize: 17, cursor: tie ? 'not-allowed' : 'pointer' }}>{advanceLabel}</button>
      </div>
    </div>
  );
}

/* ----------------------------- WINNER ----------------------------- */
function WinnerView({ ctrl, s }) {
  const teamName = (id) => s.teams.find((t) => t.id === id)?.name || '';
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: 'min(560px,100%)', textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.goldSoft, letterSpacing: 1 }}>انتهت اللعبة</div>
        <div style={{ margin: '10px 0 24px', fontFamily: "'Cairo'", fontWeight: 900, fontSize: 48, color: C.gold }}>{teamName(s.winner)} 🏆</div>
        <button onClick={ctrl.onReset} style={{ padding: '15px 40px', borderRadius: 12, border: '1px solid rgba(245,200,75,.4)', background: 'rgba(245,200,75,.12)', color: C.goldSoft, fontFamily: "'Cairo'", fontWeight: 700, fontSize: 17, cursor: 'pointer' }}>لعبة جديدة</button>
      </div>
    </div>
  );
}

/* ----------------------------- shared bits ----------------------------- */
function card(extra = {}) {
  return {
    background: C.panel,
    border: `1px solid ${extra.borderColor || 'rgba(255,255,255,.07)'}`,
    borderRadius: 14,
    padding: 18,
    flex: 'none',
  };
}
const stepBtn = { width: 38, height: 38, borderRadius: 10, border: '1px solid rgba(255,255,255,.12)', background: C.panel2, color: C.gold, fontSize: 22, fontWeight: 900, cursor: 'pointer' };
const ghostBtn = { flex: 1, padding: 11, borderRadius: 9, border: '1px solid rgba(255,255,255,.12)', background: C.panel2, color: C.mute6, fontFamily: "'Cairo'", fontWeight: 700, fontSize: 14, cursor: 'pointer' };
const miniBtn = { width: 36, height: 36, borderRadius: 9, border: '1px solid rgba(255,255,255,.12)', background: C.inputBg, color: C.mute6, fontSize: 18, fontWeight: 900, cursor: 'pointer', lineHeight: 1 };

function Center({ title, body }) {
  return (
    <div dir="rtl" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.panelDark }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: "'Cairo'", fontWeight: 900, fontSize: 24, color: C.gold }}>{title}</div>
        <div style={{ marginTop: 8, color: C.mute5, fontSize: 14 }}>{body}</div>
      </div>
    </div>
  );
}
