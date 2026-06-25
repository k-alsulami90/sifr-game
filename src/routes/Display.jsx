import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useRoomListener } from '../hooks/useRoom.js';
import { firebaseReady } from '../firebase.js';
import sound from '../sound.js';
import Lightboard from '../components/Lightboard.jsx';
import Confetti from '../components/Confetti.jsx';
import { spinPlan, countdownPlan } from '../game/timing.js';
import { toAr, cumTotal } from '../game/scoring.js';
import { TITLE_GRAD, POINTLESS_GRAD, DISPLAY_BG, C } from '../theme.js';

// narrow viewport (phone) — used to keep the stage from overflowing on small screens
function useIsNarrow(bp = 720) {
  const [narrow, setNarrow] = useState(
    typeof window !== 'undefined' ? window.innerWidth < bp : false
  );
  useEffect(() => {
    const f = () => setNarrow(window.innerWidth < bp);
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, [bp]);
  return narrow;
}

export default function Display() {
  const [params, setParams] = useSearchParams();
  const code = params.get('room');
  const [joinInput, setJoinInput] = useState('');
  const [muted, setMuted] = useState(false);
  const { room, exists, loading, error } = useRoomListener(code);
  const reduce = useReducedMotion();
  const narrow = useIsNarrow();

  // local animation state driven by Firebase tokens
  const [spinCat, setSpinCat] = useState('');
  const [count, setCount] = useState(100);

  // unlock audio on the first tap (required by mobile browsers)
  useEffect(() => {
    const unlock = () => sound.ensure();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  useEffect(() => {
    sound.setMuted(muted);
  }, [muted]);

  // ---- category spin animation ----
  const phase = room?.turnPhase;
  useEffect(() => {
    if (!room || phase !== 'spin') return;
    const cats = (
      room.sessionCategories && room.sessionCategories.length
        ? room.sessionCategories
        : [room.currentQuestion?.category]
    ).filter(Boolean);
    const finalCat = room.currentQuestion?.category || cats[0] || '';
    if (reduce) {
      setSpinCat(finalCat);
      sound.lock();
      return;
    }
    let alive = true;
    const timers = [];
    const plan = spinPlan();
    setSpinCat(cats[0] || finalCat);
    const run = (idx) => {
      if (!alive) return;
      if (idx >= plan.frames.length) {
        timers.push(
          setTimeout(() => {
            if (!alive) return;
            setSpinCat(finalCat);
            sound.lock();
          }, plan.landDelay)
        );
        return;
      }
      timers.push(
        setTimeout(() => {
          if (!alive) return;
          let sc;
          do {
            sc = cats[Math.floor(Math.random() * cats.length)];
          } while (sc === finalCat && cats.length > 1 && idx < plan.frames.length - 2);
          setSpinCat(sc);
          sound.spinTick(idx);
          run(idx + 1);
        }, plan.frames[idx].delayBefore)
      );
    };
    run(0);
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.spinToken, phase]);

  // ---- lightboard countdown animation ----
  useEffect(() => {
    if (!room || phase !== 'countdown') return;
    const target = room.targetScore ?? room.lastReveal?.score ?? 0;
    if (reduce) {
      setCount(target);
      return;
    }
    let alive = true;
    const timers = [];
    const plan = countdownPlan(target);
    setCount(100);
    let acc = 0;
    plan.frames.forEach((f) => {
      acc += f.delayBefore;
      timers.push(
        setTimeout(() => {
          if (!alive) return;
          setCount(f.value);
          sound.countTick(f.fromTarget);
        }, acc)
      );
    });
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.countdownToken, phase]);

  // ---- reveal jingle ----
  const lastRevealAt = useRef(null);
  useEffect(() => {
    if (!room || phase !== 'reveal') return;
    const at = room.lastReveal?.at;
    if (at && lastRevealAt.current === at) return;
    lastRevealAt.current = at;
    if (room.outcome === 'wrong') sound.jingleLose();
    else sound.jingleWin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, room?.lastReveal?.at, room?.outcome]);

  // ---- elimination / winner jingles ----
  useEffect(() => {
    if (room?.turnPhase === 'elimination' && room?.eliminatedThisRound != null)
      sound.jingleLose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.turnPhase, room?.eliminatedThisRound]);
  useEffect(() => {
    if (room?.status === 'game_over') sound.jingleWin();
  }, [room?.status]);

  // ---- timer warning beep (last 5s) ----
  const lastTimer = useRef(null);
  useEffect(() => {
    if (!room) return;
    const t = room.timer;
    if (room.timerRunning && t <= 5 && t > 0 && lastTimer.current !== t)
      sound.timerWarn();
    lastTimer.current = t;
  }, [room?.timer, room?.timerRunning]);

  // remember whether we ever connected — lets us tell a dropped/ended session
  // apart from a wrong room code in the gate below.
  const everConnected = useRef(false);
  useEffect(() => {
    if (exists) everConnected.current = true;
  }, [exists]);

  // keyboard shortcuts on the display: F = fullscreen, M = mute
  useEffect(() => {
    const onKey = (e) => {
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      const k = (e.key || '').toLowerCase();
      if (k === 'f') {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
        else document.exitFullscreen?.();
      } else if (k === 'm') {
        sound.ensure();
        setMuted((m) => !m);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setMuted]);

  // ---------- gates ----------
  if (!firebaseReady) return <FullMsg title="إعداد ناقص" body="لم يتم ضبط Firebase — راجع README." />;

  if (!code) {
    const join = () => {
      const c = joinInput.replace(/[^0-9]/g, '').slice(0, 4);
      if (c.length === 4) setParams({ room: c });
    };
    return (
      <Shell muted={muted} setMuted={setMuted} code={null}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ textAlign: 'center', width: 'min(420px,100%)' }}>
            <div style={brandTitle(64)}>صِفر</div>
            <div style={{ marginTop: 18, color: C.cream3, fontSize: 18, fontWeight: 700 }}>
              أدخل رمز الغرفة للانضمام
            </div>
            <input
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && join()}
              inputMode="numeric"
              placeholder="٤ أرقام"
              maxLength={4}
              style={{
                marginTop: 20,
                width: '100%',
                padding: '16px',
                borderRadius: 12,
                border: '1px solid rgba(245,200,75,.3)',
                background: C.inputBg,
                color: C.gold,
                fontFamily: "'Cairo'",
                fontWeight: 900,
                fontSize: 40,
                textAlign: 'center',
                letterSpacing: 12,
                outline: 'none',
              }}
            />
            <button onClick={join} style={primaryBtn({ marginTop: 16, width: '100%' })}>
              انضمام
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  if (loading) return <FullMsg title="جارٍ الاتصال…" body={`غرفة ${toAr(code)}`} />;
  if (!exists || !room)
    return everConnected.current ? (
      <FullMsg
        title="انقطع الاتصال بالغرفة"
        body={`غرفة ${toAr(code)} لم تعد متاحة — قد يكون المُضيف أنهى الجلسة، أو انقطع الاتصال. سيُعاد الاتصال تلقائيًّا إن عادت الغرفة.`}
        onBack={() => setParams({})}
      />
    ) : (
      <FullMsg
        title="لا توجد غرفة بهذا الرمز"
        body={`تأكد من الرمز ${toAr(code)} أو اطلب من المُضيف إنشاء جلسة.`}
        onBack={() => setParams({})}
      />
    );

  // ---------- derived ----------
  const teams = room.teams || [];
  const eliminated = room.eliminated || [];
  const log = room.log || [];
  const teamName = (id) => teams.find((t) => t.id === id)?.name || '';
  const teamDotOf = (id) => teams.find((t) => t.id === id)?.dot || '#888';
  const answering = room.answeringTeamId;
  const playing = room.status === 'playing';
  const inElim = phase === 'elimination';
  const showSpin = phase === 'spin';
  const showQuestion = phase === 'question';
  const showCountdown = phase === 'countdown';
  const showReveal = phase === 'reveal';
  const outcome = room.outcome;
  const isPointless = outcome === 'pointless';
  const isWrong = outcome === 'wrong';
  const isScored = outcome === 'scored';

  const dStandby = room.status === 'setup';
  const dPlaying = playing && !inElim;
  const dElim = playing && inElim;
  const dWinner = room.status === 'game_over';

  // used answers across the whole round (same question, both passes)
  const usedRound = log.filter(
    (e) => e.round === room.currentRound && ['scored', 'pointless'].includes(e.outcome)
  );
  const minS = usedRound.length ? Math.min(...usedRound.map((r) => r.score)) : null;

  const ring = 339.3;
  const timer = room.timer ?? 0;
  const ringOffset = ring * (1 - timer / (room.timerMax || 30));
  const lr = room.lastReveal || {};
  const target = room.targetScore ?? lr.score ?? 0;

  return (
    <Shell muted={muted} setMuted={setMuted} code={code}>
      <div style={{ position: 'absolute', inset: 0, background: DISPLAY_BG, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* STANDBY — full screen, no scoreboard */}
        {dStandby && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={brandTitle('min(22vw,300px)')}>صِفر</div>
              <div style={{ marginTop: 18, fontSize: 'clamp(20px,2.4vw,34px)', fontWeight: 700, color: C.cream3 }}>
                أندرُ إجابة… أعلى فوز
              </div>
              <div style={{ marginTop: 22, fontSize: 'clamp(16px,1.8vw,22px)', color: C.mute5 }}>
                رمز الغرفة
              </div>
              <div style={{ fontFamily: "'Cairo'", fontWeight: 900, fontSize: 'clamp(48px,8vw,110px)', color: C.gold, letterSpacing: 10 }}>
                {toAr(code)}
              </div>
              <div style={{ marginTop: 18, display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 22px', border: '1px solid rgba(245,200,75,.3)', borderRadius: 100, color: C.mute5, fontSize: 16 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: C.gold, animation: 'livePulse 1.4s infinite' }} />
                المُضيف يُجهّز الجلسة…
              </div>
            </div>
          </div>
        )}

        {/* scoreboard strip — a non-shrinking flex row at the top, ALWAYS visible
            during playing / elimination / winner. As a real flex item it pushes
            the stage down instead of overlapping it, no matter how many teams. */}
        {!dStandby && (
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: 'clamp(10px,1.4vh,18px) clamp(20px,3vw,48px)', borderBottom: '1px solid rgba(255,255,255,.08)', background: 'rgba(10,10,15,.9)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
              <span style={{ fontFamily: "'Cairo'", fontWeight: 900, fontSize: 'clamp(15px,1.7vw,24px)', color: C.gold }}>
                {dWinner ? 'النتيجة النهائية' : `الجولة ${toAr(room.currentRound)}`}
              </span>
              {!dWinner && (
                <span style={{ color: C.mute2, fontSize: 'clamp(11px,1.1vw,15px)', fontWeight: 700 }}>
                  الدور {toAr(room.currentPass)} من ٢
                </span>
              )}
            </div>
            {/* P1: persistent legend so any viewer grasps the inverted scoring rule */}
            {dPlaying && (
              <div style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, padding: 'clamp(5px,.7vh,8px) clamp(12px,1.4vw,18px)', borderRadius: 100, background: 'rgba(245,200,75,.10)', border: '1px solid rgba(245,200,75,.28)' }}>
                <span style={{ color: C.gold, fontSize: 'clamp(13px,1.3vw,18px)', lineHeight: 1 }}>↓</span>
                <span style={{ color: C.goldSoft, fontFamily: "'Cairo'", fontWeight: 900, fontSize: 'clamp(12px,1.2vw,16px)' }}>الأقل = الأندر = الأفضل</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 'clamp(7px,.9vw,14px)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {teams.map((t) => {
                const elim = eliminated.includes(t.id) || t.id === room.eliminatedThisRound;
                const isWinnerTeam = dWinner && t.id === room.winner;
                const isTurn = !inElim && !dWinner && t.id === answering && (showQuestion || showCountdown);
                return (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      padding: 'clamp(6px,.9vh,10px) clamp(11px,1.3vw,16px)',
                      borderRadius: 100,
                      border: isWinnerTeam ? '1px solid rgba(245,200,75,.7)' : isTurn ? '1px solid rgba(245,200,75,.55)' : '1px solid rgba(255,255,255,.08)',
                      background: isWinnerTeam ? 'rgba(245,200,75,.2)' : isTurn ? 'rgba(245,200,75,.14)' : elim ? 'rgba(255,255,255,.02)' : 'rgba(255,255,255,.05)',
                      opacity: elim && !isWinnerTeam ? 0.55 : 1,
                    }}
                  >
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.dot, flex: 'none' }} />
                    <span style={{ fontFamily: "'Cairo'", fontWeight: 700, fontSize: 'clamp(13px,1.3vw,18px)', color: elim && !isWinnerTeam ? '#5a5650' : C.cream3, textDecoration: elim && !isWinnerTeam ? 'line-through' : 'none' }}>
                      {t.name}
                    </span>
                    <span style={{ fontFamily: "'Cairo'", fontWeight: 900, fontSize: 'clamp(15px,1.5vw,22px)', color: elim && !isWinnerTeam ? '#5a5650' : isWinnerTeam ? C.gold : C.goldSoft }}>
                      {toAr(cumTotal(log, t.id))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* stage — fills the remaining height below the scoreboard. Each phase
            renders inside this single box, so nothing can cover the scoreboard. */}
        {!dStandby && (
          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>

        {/* PLAYING */}
        {dPlaying && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
            {/* main stage */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'stretch', padding: 'clamp(16px,2.4vh,34px) clamp(28px,4vw,64px)' }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: 'clamp(20px,3vw,48px)' }}>
                <AnimatePresence mode="wait">
                  {/* SPIN */}
                  {showSpin && (
                    <motion.div key="spin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 'clamp(16px,1.8vw,26px)', fontWeight: 700, color: C.mute4, marginBottom: 18 }}>الفئة القادمة…</div>
                      <div style={{ fontFamily: "'Cairo'", fontWeight: 900, fontSize: 'clamp(48px,7vw,120px)', lineHeight: 1, color: C.gold, filter: 'drop-shadow(0 0 26px rgba(245,200,75,.5))' }}>
                        {spinCat || room.currentQuestion?.category}
                      </div>
                      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 9 }}>
                        {[0, 0.2, 0.4].map((d, i) => (
                          <span key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: C.gold, animation: `livePulse 1s infinite ${d}s` }} />
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* QUESTION */}
                  {showQuestion && (
                    <motion.div key="question" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                        <span style={{ padding: '9px 20px', borderRadius: 100, background: 'rgba(245,200,75,.14)', border: '1px solid rgba(245,200,75,.35)', color: C.goldSoft, fontFamily: "'Cairo'", fontWeight: 700, fontSize: 'clamp(16px,1.7vw,24px)', animation: 'lockBoom .5s ease both' }}>
                          {room.currentQuestion?.category}
                        </span>
                      </div>
                      <div style={{ fontFamily: "'Cairo'", fontWeight: 900, fontSize: 'clamp(34px,4.4vw,72px)', lineHeight: 1.18, color: C.cream2, textWrap: 'balance' }}>
                        {room.currentQuestion?.question}
                      </div>
                      <div style={{ marginTop: 32, display: 'flex', alignItems: 'center', gap: 28 }}>
                        <div style={{ position: 'relative', width: 'clamp(92px,8vw,128px)', height: 'clamp(92px,8vw,128px)', flex: 'none' }}>
                          <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                            <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="9" />
                            <circle cx="60" cy="60" r="54" fill="none" stroke="#F5C84B" strokeWidth="9" strokeLinecap="round" strokeDasharray="339.3" strokeDashoffset={ringOffset} style={{ transition: 'stroke-dashoffset .9s linear', filter: 'drop-shadow(0 0 6px rgba(245,200,75,.7))' }} />
                          </svg>
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cairo'", fontWeight: 900, fontSize: 'clamp(26px,2.8vw,42px)', color: C.gold }}>
                            {toAr(timer)}
                          </div>
                        </div>
                        <div>
                          <div style={{ color: C.mute4, fontSize: 'clamp(13px,1.2vw,17px)', fontWeight: 700, marginBottom: 4 }}>دور الإجابة الآن</div>
                          <div style={{ fontFamily: "'Cairo'", fontWeight: 900, fontSize: 'clamp(28px,3vw,48px)', color: C.cream2 }}>{teamName(answering)}</div>
                        </div>
                      </div>
                      {usedRound.length > 0 && (() => {
                        // cap the strip so a long round can't crowd out the question:
                        // keep the best (lowest) answer + the most recent, summarize the rest
                        const MAX = 6;
                        let shown = usedRound;
                        let hidden = 0;
                        if (usedRound.length > MAX) {
                          const recent = usedRound.slice(-MAX);
                          const leadEntry = usedRound.find((r) => r.score === minS);
                          shown = leadEntry && !recent.includes(leadEntry) ? [leadEntry, ...recent.slice(1)] : recent;
                          hidden = usedRound.length - shown.length;
                        }
                        return (
                          <div style={{ marginTop: 30, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <span style={{ color: C.mute4, fontSize: 'clamp(13px,1.2vw,16px)', fontWeight: 700 }}>الإجابات المستخدمة:</span>
                            {hidden > 0 && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '8px 14px', borderRadius: 100, fontFamily: "'Cairo'", fontWeight: 900, fontSize: 'clamp(13px,1.3vw,17px)', border: '1px solid rgba(255,255,255,.1)', background: 'rgba(255,255,255,.04)', color: C.mute4 }}>
                                +{toAr(hidden)}
                              </span>
                            )}
                            {shown.map((r, i) => {
                              const lead = r.score === minS;
                              return (
                                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 100, fontFamily: "'Cairo'", fontWeight: 700, fontSize: 'clamp(14px,1.4vw,18px)', border: lead ? '1px solid rgba(245,200,75,.5)' : '1px solid rgba(255,255,255,.1)', background: lead ? 'rgba(245,200,75,.16)' : 'rgba(255,255,255,.04)', color: lead ? C.goldSoft : C.mute5 }}>
                                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: teamDotOf(r.teamId) }} />
                                  {r.answer} · {toAr(r.score)}
                                </span>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </motion.div>
                  )}

                  {/* COUNTDOWN */}
                  {showCountdown && (
                    <motion.div key="countdown" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <div style={{ fontSize: 'clamp(16px,1.6vw,24px)', fontWeight: 700, color: C.mute4, marginBottom: 4 }}>
                        {teamName(lr.teamId)} · جارٍ احتساب نُدرة الإجابة…
                      </div>
                      <div style={{ fontFamily: "'Cairo'", fontWeight: 900, fontSize: 'min(36vh,380px)', lineHeight: 0.82, color: C.gold, filter: 'drop-shadow(0 0 30px rgba(245,200,75,.55))' }}>
                        {toAr(count)}
                      </div>
                    </motion.div>
                  )}

                  {/* REVEAL */}
                  {showReveal && (
                    <motion.div key="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'relative' }}>
                      {isPointless && (
                        <div style={{ animation: 'flareIn .6s cubic-bezier(.16,1,.3,1) both' }}>
                          <div style={{ fontSize: 'clamp(18px,1.8vw,26px)', fontWeight: 700, color: C.goldSoft, letterSpacing: 1 }}>إجابة نادرة جدًّا!</div>
                          <div style={{ fontFamily: "'Cairo'", fontWeight: 900, fontSize: 'min(38vh,400px)', lineHeight: 0.82, background: POINTLESS_GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', filter: 'drop-shadow(0 0 40px rgba(245,200,75,.7))' }}>صِفر!</div>
                          <div style={{ marginTop: 6, fontFamily: "'Cairo'", fontWeight: 900, fontSize: 'clamp(24px,2.4vw,40px)', color: C.cream2 }}>
                            {teamName(lr.teamId)} <span style={{ color: C.mute4, fontWeight: 700, fontSize: '.7em' }}>·</span> <span style={{ color: C.goldSoft }}>{lr.answerText}</span>
                          </div>
                        </div>
                      )}
                      {isWrong && (
                        <div style={{ animation: 'shake .5s ease both' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 'clamp(88px,9vw,140px)', height: 'clamp(88px,9vw,140px)', borderRadius: '50%', border: '6px solid #FF5A5A', color: '#FF5A5A', fontFamily: "'Cairo'", fontWeight: 900, fontSize: 'clamp(54px,5.6vw,90px)', filter: 'drop-shadow(0 0 24px rgba(255,90,90,.6))' }}>✕</div>
                          <div style={{ marginTop: 18, fontFamily: "'Cairo'", fontWeight: 900, fontSize: 'clamp(40px,4.6vw,80px)', color: C.danger2 }}>
                            {timer === 0 ? 'انتهى الوقت' : 'إجابة خاطئة'}
                          </div>
                          <div style={{ marginTop: 6, fontFamily: "'Cairo'", fontWeight: 900, fontSize: 'clamp(24px,2.4vw,38px)', color: C.cream2 }}>{teamName(lr.teamId)}</div>
                          <div style={{ marginTop: 8, fontFamily: "'Cairo'", fontWeight: 900, fontSize: 'clamp(18px,1.8vw,28px)', color: C.danger3 }}>+{toAr(100)} نقطة — الأسوأ</div>
                        </div>
                      )}
                      {isScored && (
                        <div style={{ animation: 'flareIn .5s ease both' }}>
                          <div style={{ fontSize: 'clamp(16px,1.6vw,24px)', fontWeight: 700, color: C.mute4 }}>نُدرة الإجابة</div>
                          <div style={{ fontFamily: "'Cairo'", fontWeight: 900, fontSize: 'min(38vh,400px)', lineHeight: 0.82, color: C.gold, filter: 'drop-shadow(0 0 30px rgba(245,200,75,.5))' }}>{toAr(target)}</div>
                          <div style={{ marginTop: 6, fontFamily: "'Cairo'", fontWeight: 900, fontSize: 'clamp(24px,2.4vw,40px)', color: C.cream2 }}>
                            {teamName(lr.teamId)} <span style={{ color: C.mute4, fontWeight: 700, fontSize: '.7em' }}>·</span> <span style={{ color: C.mute6 }}>{lr.answerText}</span>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* lightboard tower — hidden on phones so it can't crowd the
                  stage; the big center number carries the countdown there */}
              {!narrow && (
                <Lightboard
                  count={count}
                  mode={showCountdown || showReveal ? 'live' : 'full'}
                  flare={showReveal && isPointless}
                />
              )}
            </div>

            <Confetti show={showReveal && isPointless} />
          </div>
        )}

        {/* ELIMINATION */}
        {dElim && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5vh 6vw', overflowY: 'auto', background: 'radial-gradient(ellipse 70% 60% at 50% 45%,rgba(255,90,90,.12),transparent 65%)' }}>
            {room.eliminatedThisRound == null && (room.tieCandidates || []).length > 0 ? (
              <div style={{ textAlign: 'center', animation: 'elimRise .6s cubic-bezier(.2,.9,.3,1) both' }}>
                <div style={{ fontSize: 'clamp(18px,2vw,30px)', fontWeight: 700, color: C.goldSoft, letterSpacing: 2 }}>تعادل في المركز الأخير</div>
                <div style={{ margin: '18px 0', display: 'flex', gap: 18, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {room.tieCandidates.map((id) => (
                    <span key={id} style={{ fontFamily: "'Cairo'", fontWeight: 900, fontSize: 'clamp(28px,4vw,64px)', color: C.cream2 }}>
                      {teamName(id)}
                    </span>
                  ))}
                </div>
                <div style={{ color: C.mute4, fontSize: 'clamp(15px,1.5vw,20px)', fontWeight: 700 }}>بانتظار قرار المُضيف…</div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', animation: 'elimRise .6s cubic-bezier(.2,.9,.3,1) both' }}>
                <div style={{ fontSize: 'clamp(18px,2vw,30px)', fontWeight: 700, color: C.danger3, letterSpacing: 2 }}>خرج من المنافسة</div>
                <div style={{ margin: '16px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                  <span style={{ width: 'clamp(22px,2.4vw,34px)', height: 'clamp(22px,2.4vw,34px)', borderRadius: '50%', background: teamDotOf(room.eliminatedThisRound) }} />
                  <span style={{ fontFamily: "'Cairo'", fontWeight: 900, fontSize: 'min(14vw,180px)', lineHeight: 0.9, color: C.danger2, textDecoration: 'line-through', textDecorationThickness: 6 }}>
                    {teamName(room.eliminatedThisRound)}
                  </span>
                </div>
                <div style={{ fontFamily: "'Cairo'", fontWeight: 900, fontSize: 'clamp(22px,2.2vw,36px)', color: C.cream2 }}>
                  مجموع هذه الجولة {toAr(roundTotalOf(log, room.eliminatedThisRound, room.currentRound))} — الأعلى
                </div>
                <div style={{ marginTop: 10, color: C.mute4, fontSize: 'clamp(15px,1.5vw,20px)', fontWeight: 700 }}>
                  {remainingCount(teams, eliminated, room.eliminatedThisRound) <= 1
                    ? 'تبقّى فريق واحد!'
                    : `يتبقّى ${toAr(remainingCount(teams, eliminated, room.eliminatedThisRound))} فرق`}
                </div>
              </div>
            )}
          </div>
        )}

        {/* WINNER */}
        {dWinner && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4vh 6vw', overflowY: 'auto', background: 'radial-gradient(ellipse 70% 60% at 50% 38%,rgba(245,200,75,.18),transparent 65%)' }}>
            <Confetti show count={48} />
            <div style={{ position: 'relative', textAlign: 'center', animation: 'flareIn .7s cubic-bezier(.16,1,.3,1) both' }}>
              <div style={{ fontSize: 'clamp(18px,2vw,28px)', fontWeight: 700, color: C.goldSoft, letterSpacing: 2 }}>آخر فريق صامد — البطل</div>
              <div style={{ ...brandTitle('min(15vw,190px)'), margin: '12px 0', animation: 'glowBreath 3s infinite' }}>{teamName(room.winner)}</div>
              <div style={{ fontFamily: "'Cairo'", fontWeight: 900, fontSize: 'clamp(20px,2vw,32px)', color: C.cream2 }}>صمد حتى النهاية بأندر الإجابات</div>
            </div>
          </div>
        )}

          </div>
        )}
      </div>
    </Shell>
  );
}

// ----- small helpers -----
function roundTotalOf(log, teamId, round) {
  return (log || [])
    .filter((e) => e.teamId === teamId && e.round === round)
    .reduce((a, e) => a + e.score, 0);
}
function remainingCount(teams, eliminated, justOut) {
  return (teams || []).filter((t) => !eliminated.includes(t.id) && t.id !== justOut).length;
}
function brandTitle(size) {
  return {
    fontFamily: "'Cairo'",
    fontWeight: 900,
    fontSize: size,
    lineHeight: 0.9,
    background: TITLE_GRAD,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  };
}
function primaryBtn(extra = {}) {
  return {
    padding: '14px 22px',
    borderRadius: 12,
    border: 'none',
    background: 'linear-gradient(180deg,#FFE49A,#F5C84B 60%,#D6A52F)',
    color: '#2a2008',
    fontFamily: "'Cairo'",
    fontWeight: 900,
    fontSize: 18,
    cursor: 'pointer',
    ...extra,
  };
}

function Shell({ children, muted, setMuted, code }) {
  const fs = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  };
  return (
    <div dir="rtl" lang="ar" style={{ position: 'fixed', inset: 0, background: '#08080c', overflow: 'hidden' }}>
      {children}
      <div style={{ position: 'fixed', top: 10, left: 10, display: 'flex', gap: 8, zIndex: 60 }}>
        {code && (
          <span style={{ height: 30, display: 'inline-flex', alignItems: 'center', padding: '0 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(20,20,28,.6)', color: C.mute6, fontSize: 12, fontWeight: 700 }}>
            غرفة {toAr(code)}
          </span>
        )}
        <button onClick={() => { sound.ensure(); setMuted((m) => !m); }} title="الصوت" style={iconBtn}>
          {muted ? '🔇' : '🔊'}
        </button>
        <button onClick={fs} title="ملء الشاشة" style={iconBtn}>⛶</button>
      </div>
    </div>
  );
}

const iconBtn = {
  height: 30,
  width: 36,
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,.1)',
  background: 'rgba(20,20,28,.6)',
  color: '#cfc8b6',
  fontSize: 13,
  cursor: 'pointer',
};

function FullMsg({ title, body, onBack }) {
  return (
    <div dir="rtl" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#08080c', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontFamily: "'Cairo'", fontWeight: 900, fontSize: 28, color: C.gold }}>{title}</div>
        <div style={{ marginTop: 10, color: C.mute5, fontSize: 15, lineHeight: 1.7 }}>{body}</div>
        {onBack && (
          <button onClick={onBack} style={primaryBtn({ marginTop: 20 })}>أدخل رمزاً آخر</button>
        )}
      </div>
    </div>
  );
}
