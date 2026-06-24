// Authoritative game engine for صِفر.
//
// The Admin screen owns a single instance of this controller; it holds the full
// game state, runs all phase transitions on timers, and emits a fresh state
// snapshot through `onChange` after every mutation. The Admin renders from that
// snapshot AND mirrors `toRoom()` into Firebase so the read-only Display screen
// can render and animate from it.
//
// Mechanics (matching the Sifr Game design):
//   • A round = 2 passes through the still-active teams.
//   • Pass 1 ascending order, Pass 2 reversed.
//   • Each pass spins up its own category + question; every team in that pass
//     answers the same question, and no answer may be reused within the pass.
//   • Lower score = rarer = better. After both passes, the team with the
//     HIGHEST combined round total is eliminated. Ties are resolved by the host.
//   • Last team standing wins.

import { spinPlan, countdownPlan } from './timing.js';
import {
  teamDot,
  DEFAULT_TEAM_NAMES,
  roundTotal,
  activeTeamIds,
  usedAnswersThisRound,
} from './scoring.js';

const MIN_TEAMS = 2;
const MAX_TEAMS = 8;
const TIMER_START = 30;

export default class GameController {
  constructor(bank, onChange) {
    this.bank = bank && bank.length ? bank : [{ cat: '—', questions: [] }];
    this.onChange = onChange || (() => {});
    this._timeouts = [];
    this._interval = null;
    this.state = this.initialState(3);
  }

  // ---------- lifecycle ----------
  initialState(numTeams, prevTeams = []) {
    return {
      status: 'setup', // setup | playing | game_over
      numTeams,
      teams: this.makeTeams(numTeams, prevTeams),
      safePicks: this.defaultPicks(numTeams),
      sessionCats: [],
      eliminated: [],
      currentRound: 1,
      currentPass: 1,
      turnOrder: [],
      answeringPos: 0,
      turnPhase: 'spin', // spin | question | countdown | reveal | elimination
      lockedCat: 0,
      currentQ: 0,
      currentQuestion: null,
      targetScore: null,
      outcome: null,
      lastReveal: null,
      eliminatedThisRound: null,
      tieCandidates: [],
      winner: null,
      timer: TIMER_START,
      timerRunning: false,
      entryAnswer: '',
      entryScore: '',
      log: [],
      spinToken: 0,
      countdownToken: 0,
    };
  }

  makeTeams(n, prev = []) {
    return Array.from({ length: n }, (_, i) => ({
      id: 't' + (i + 1),
      name: (prev[i] && prev[i].name) || DEFAULT_TEAM_NAMES[i] || 'فريق ' + (i + 1),
      dot: teamDot(i),
    }));
  }

  // category indices that currently hold at least one question
  nonEmptyCatIndices() {
    return this.bank.map((_, i) => i).filter((i) => (this.bank[i].questions || []).length > 0);
  }

  // default guaranteed-category picks land only on categories that have questions
  defaultPicks(n) {
    const ne = this.nonEmptyCatIndices();
    const base = ne.length ? ne : [0];
    return Array.from({ length: n }, (_, i) => base[i % base.length]);
  }

  destroy() {
    this.clearScheduled();
    if (this._interval) clearInterval(this._interval);
  }

  // ---------- internal helpers ----------
  _set(patch) {
    this.state = { ...this.state, ...patch };
    this.onChange(this.state);
  }

  clearScheduled() {
    this._timeouts.forEach((t) => clearTimeout(t));
    this._timeouts = [];
  }

  schedule(fn, ms) {
    const id = setTimeout(fn, ms);
    this._timeouts.push(id);
    return id;
  }

  resolveQuestion(catIndex, qIndex) {
    const cat = this.bank[catIndex] || { cat: '—', questions: [] };
    const q = cat.questions[qIndex] || { id: '', q: '', ans: [] };
    return {
      id: q.id,
      category: cat.cat,
      question: q.q,
      answers: (q.ans || []).map((a) => ({ text: a.a, score: a.s, note: a.note })),
    };
  }

  get currentQ() {
    const cat = this.bank[this.state.lockedCat];
    return (cat && cat.questions[this.state.currentQ]) || { q: '', ans: [] };
  }

  activeIds() {
    return activeTeamIds(this.state.teams, this.state.eliminated);
  }

  answeringTeamId() {
    return this.state.turnOrder[this.state.answeringPos];
  }

  // reveals this pass (excludes manual adjustments)
  revsThisPass() {
    const s = this.state;
    return s.log.filter(
      (e) =>
        e.round === s.currentRound &&
        e.pass === s.currentPass &&
        ['scored', 'pointless', 'wrong'].includes(e.outcome)
    );
  }

  // ---------- setup ----------
  rebuildTeams = (n) => {
    const num = Math.max(MIN_TEAMS, Math.min(MAX_TEAMS, n));
    const teams = this.makeTeams(num, this.state.teams);
    const def = this.defaultPicks(num);
    const safePicks = Array.from(
      { length: num },
      (_, i) => this.state.safePicks[i] ?? def[i]
    );
    this._set({ numTeams: num, teams, safePicks });
  };

  setName = (id, name) => {
    this._set({
      teams: this.state.teams.map((t) => (t.id === id ? { ...t, name } : t)),
    });
  };

  setSafe = (teamIdx, catIdx) => {
    const sp = this.state.safePicks.slice();
    sp[teamIdx] = catIdx;
    this._set({ safePicks: sp });
  };

  startGame = () => {
    const nonEmpty = this.nonEmptyCatIndices();
    if (!nonEmpty.length) return; // no questions loaded yet — cannot start
    const unique = [...new Set(this.state.safePicks)].filter((i) => nonEmpty.includes(i));
    const pool = unique.length ? [...unique] : [nonEmpty[0]];
    const others = nonEmpty
      .filter((i) => !pool.includes(i))
      .sort(() => Math.random() - 0.5);
    const target = Math.min(nonEmpty.length, Math.max(unique.length + 2, 4));
    while (pool.length < target && others.length) pool.push(others.shift());
    this._set({
      status: 'playing',
      sessionCats: pool,
      eliminated: [],
      currentRound: 1,
      log: [],
      winner: null,
      eliminatedThisRound: null,
      tieCandidates: [],
    });
    this.schedule(() => this.beginTurn(1), 30);
  };

  // ---------- turn flow ----------
  buildTurnOrder(pass) {
    const a = this.activeIds();
    return pass === 2 ? a.slice().reverse() : a;
  }

  // doSpin: true at the start of a round (pass 1) to reveal a fresh category +
  // question. Pass 2 reuses the SAME question, so it skips the spin and goes
  // straight back to answering in reversed order.
  beginTurn(pass, doSpin = true) {
    const order = this.buildTurnOrder(pass);
    if (this._interval) clearInterval(this._interval);
    this._set({
      currentPass: pass,
      turnOrder: order,
      answeringPos: 0,
      entryAnswer: '',
      entryScore: '',
      timer: TIMER_START,
      timerRunning: false,
      outcome: null,
      lastReveal: null,
    });
    if (doSpin) {
      this.schedule(() => this.startSpin(), 20);
    } else {
      // same question continues into the second pass — no new category spin
      this.schedule(
        () => this._set({ turnPhase: 'question', timer: TIMER_START }),
        20
      );
    }
  }

  startSpin() {
    this.clearScheduled();
    const pool = this.state.sessionCats.length
      ? this.state.sessionCats
      : this.nonEmptyCatIndices();
    if (!pool.length) return;
    const finalCat = pool[Math.floor(Math.random() * pool.length)];
    const cat = this.bank[finalCat];
    const qi = Math.floor(Math.random() * Math.max(1, cat.questions.length));
    const currentQuestion = this.resolveQuestion(finalCat, qi);
    this._set({
      turnPhase: 'spin',
      lockedCat: finalCat,
      currentQ: qi,
      currentQuestion,
      spinToken: this.state.spinToken + 1,
      outcome: null,
      lastReveal: null,
    });
    const plan = spinPlan();
    this.schedule(
      () => this._set({ turnPhase: 'question', timer: TIMER_START }),
      plan.total
    );
  }

  // ---------- reveal + countdown ----------
  revealWith(score, outcome, answer) {
    this.clearScheduled();
    if (this._interval) clearInterval(this._interval);
    const teamId = this.answeringTeamId();
    const entry = {
      round: this.state.currentRound,
      pass: this.state.currentPass,
      teamId,
      score,
      outcome,
      answer,
    };
    const lastReveal = { teamId, answerText: answer, score, outcome, at: Date.now() };
    this._set({
      log: [...this.state.log, entry],
      turnPhase: 'countdown',
      targetScore: score,
      outcome,
      lastReveal,
      timerRunning: false,
      countdownToken: this.state.countdownToken + 1,
    });
    const plan = countdownPlan(score);
    this.schedule(() => this._set({ turnPhase: 'reveal' }), plan.total);
  }

  onReveal = () => {
    const raw = Number(
      String(this.state.entryScore)
        .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
        .replace(/[^0-9]/g, '')
    );
    const score = Math.max(0, Math.min(100, isNaN(raw) ? 0 : raw));
    const outcome = score === 0 ? 'pointless' : 'scored';
    this.revealWith(score, outcome, this.state.entryAnswer || 'إجابة نادرة');
  };

  quickPointless = () =>
    this.revealWith(0, 'pointless', this.state.entryAnswer || 'إجابة نادرة غير مُدرجة');

  quickWrong = () => this.revealWith(0, 'wrong', '—');

  onContinue = () => {
    const pos = this.state.answeringPos + 1;
    if (pos < this.state.turnOrder.length) {
      this._set({
        answeringPos: pos,
        entryAnswer: '',
        entryScore: '',
        turnPhase: 'question',
        timer: TIMER_START,
        timerRunning: false,
        outcome: null,
        lastReveal: null,
      });
    } else if (this.state.currentPass === 1) {
      this.beginTurn(2, false); // pass 2: same question, reversed order
    } else {
      this.finishRound();
    }
  };

  finishRound() {
    const active = this.activeIds();
    const totals = active.map((id) => ({
      id,
      total: roundTotal(this.state.log, id, this.state.currentRound),
    }));
    const max = Math.max(...totals.map((t) => t.total));
    const candidates = totals.filter((t) => t.total === max).map((t) => t.id);
    if (candidates.length > 1) {
      // tie for the highest (worst) — host must resolve
      this._set({
        turnPhase: 'elimination',
        tieCandidates: candidates,
        eliminatedThisRound: null,
      });
    } else {
      this._set({
        turnPhase: 'elimination',
        eliminatedThisRound: candidates[0],
        tieCandidates: [],
      });
    }
  }

  resolveTie = (teamId) => {
    this._set({ eliminatedThisRound: teamId, tieCandidates: [] });
  };

  onAdvance = () => {
    if (this.state.eliminatedThisRound == null) return; // tie unresolved
    const eliminated = [...this.state.eliminated, this.state.eliminatedThisRound];
    const remaining = this.state.teams
      .map((t) => t.id)
      .filter((id) => !eliminated.includes(id));
    if (remaining.length <= 1) {
      this._set({
        eliminated,
        status: 'game_over',
        winner: remaining[0],
      });
    } else {
      this._set({
        eliminated,
        currentRound: this.state.currentRound + 1,
        eliminatedThisRound: null,
        tieCandidates: [],
        outcome: null,
        lastReveal: null,
      });
      this.schedule(() => this.beginTurn(1), 30);
    }
  };

  onReset = () => {
    this.clearScheduled();
    if (this._interval) clearInterval(this._interval);
    this.state = this.initialState(this.state.numTeams, this.state.teams);
    this.state.safePicks = this.state.teams.map(
      (_, i) => this.state.safePicks?.[i] ?? i % this.bank.length
    );
    this.onChange(this.state);
  };

  // ---------- timer (admin-owned) ----------
  startTimer = () => {
    if (this._interval) clearInterval(this._interval);
    this._set({ timerRunning: true });
    this._interval = setInterval(() => {
      if (this.state.timer <= 0) {
        clearInterval(this._interval);
        this._set({ timer: 0, timerRunning: false });
        return;
      }
      this._set({ timer: this.state.timer - 1 });
    }, 1000);
  };

  pauseTimer = () => {
    if (this._interval) clearInterval(this._interval);
    this._set({ timerRunning: false });
  };

  resetTimer = () => {
    if (this._interval) clearInterval(this._interval);
    this._set({ timer: TIMER_START, timerRunning: false });
  };

  // ---------- answer entry ----------
  setEntryAnswer = (v) => this._set({ entryAnswer: v });
  setEntryScore = (v) => this._set({ entryScore: v });
  pickSuggestion = (text, score) =>
    this._set({
      entryAnswer: text,
      entryScore: String(score).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]),
    });

  // ---------- manual score adjust (edge cases) ----------
  manualAdjust = (teamId, delta) => {
    this._set({
      log: [
        ...this.state.log,
        {
          round: this.state.currentRound,
          pass: 0,
          teamId,
          score: delta,
          outcome: 'adjust',
          answer: '',
        },
      ],
    });
  };

  // ---------- Firebase projection (what the Display reads) ----------
  toRoom() {
    const s = this.state;
    return {
      status: s.status,
      teams: s.teams,
      eliminated: s.eliminated,
      settings: { teamCount: s.numTeams, rounds: Math.max(1, s.numTeams - 1) },
      sessionCategories: s.sessionCats
        .map((ci) => this.bank[ci] && this.bank[ci].cat)
        .filter(Boolean),
      currentRound: s.currentRound,
      currentPass: s.currentPass,
      turnOrder: s.turnOrder,
      answeringPos: s.answeringPos,
      answeringTeamId: s.turnOrder[s.answeringPos] ?? null,
      turnPhase: s.turnPhase,
      currentQuestion: s.currentQuestion,
      log: s.log,
      usedAnswers: usedAnswersThisRound(s.log, s.currentRound).map((e) => ({
        text: e.answer,
        score: e.score,
        teamId: e.teamId,
      })),
      lastReveal: s.lastReveal,
      targetScore: s.targetScore,
      outcome: s.outcome,
      timer: s.timer,
      timerRunning: s.timerRunning,
      eliminatedThisRound: s.eliminatedThisRound,
      tieCandidates: s.tieCandidates,
      winner: s.winner,
      spinToken: s.spinToken,
      countdownToken: s.countdownToken,
      updatedAt: Date.now(),
    };
  }
}
