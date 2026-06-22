// Falling gold confetti — used on the Pointless reveal and the winner screen.
import { useMemo } from 'react';

const COLS = ['#F5C84B', '#FFE49A', '#FFD970', '#C9962A'];

export default function Confetti({ show, count = 38 }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        key: 'cf' + i,
        style: {
          position: 'absolute',
          top: '0',
          left: (Math.random() * 100).toFixed(1) + '%',
          width: (5 + Math.random() * 6).toFixed(0) + 'px',
          height: (9 + Math.random() * 10).toFixed(0) + 'px',
          background: COLS[i % 4],
          borderRadius: '2px',
          animation: `confFall ${(2.4 + Math.random() * 1.8).toFixed(2)}s linear ${(
            Math.random() * 1.2
          ).toFixed(2)}s infinite`,
        },
      })),
    [count]
  );
  if (!show) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {pieces.map((p) => (
        <span key={p.key} style={p.style} />
      ))}
    </div>
  );
}
