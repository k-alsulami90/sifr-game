// Firebase Realtime Database room helpers.
//   • Admin writes the full game projection via writeRoom / createRoom.
//   • Display subscribes (read-only) via useRoomListener.
import { useEffect, useState } from 'react';
import { ref, set, onValue, remove, get } from 'firebase/database';
import { db, firebaseReady } from '../firebase';

export function gen4() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// RTDB rejects `undefined`; round-tripping through JSON strips it.
function sanitize(obj) {
  return JSON.parse(JSON.stringify(obj ?? {}));
}

// Create a room under a fresh, unused 4-digit code. Returns the code.
export async function createRoom(initial) {
  if (!firebaseReady || !db) return gen4();
  let code = gen4();
  for (let i = 0; i < 12; i++) {
    const snap = await get(ref(db, 'rooms/' + code));
    if (!snap.exists()) break;
    code = gen4();
  }
  await set(ref(db, 'rooms/' + code), sanitize(initial));
  return code;
}

export function writeRoom(code, data) {
  if (!firebaseReady || !db || !code) return Promise.resolve();
  return set(ref(db, 'rooms/' + code), sanitize(data));
}

export function clearRoom(code) {
  if (!firebaseReady || !db || !code) return Promise.resolve();
  return remove(ref(db, 'rooms/' + code));
}

export async function roomExists(code) {
  if (!firebaseReady || !db || !code) return false;
  const snap = await get(ref(db, 'rooms/' + code));
  return snap.exists();
}

// Live subscription used by the Display screen.
export function useRoomListener(code) {
  const [state, setState] = useState({
    room: null,
    exists: false,
    loading: !!code,
    error: null,
  });

  useEffect(() => {
    if (!firebaseReady || !db) {
      setState({ room: null, exists: false, loading: false, error: 'no-config' });
      return;
    }
    if (!code) {
      setState({ room: null, exists: false, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    const r = ref(db, 'rooms/' + code);
    const unsub = onValue(
      r,
      (snap) => {
        setState({
          room: snap.val(),
          exists: snap.exists(),
          loading: false,
          error: null,
        });
      },
      (err) => setState({ room: null, exists: false, loading: false, error: err.message })
    );
    return () => unsub();
  }, [code]);

  return state;
}
