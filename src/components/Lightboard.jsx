// 100-row lightboard tower for the Display screen — Pointless-style.
// A vertical stack of 100 thin horizontal bars. Display index i (0 = top) maps
// to value v = 99 - i, so the board fills from the BOTTOM up and drains from the
// TOP down as `count` falls (100 → target), exactly like the show's board.

function rowStyle(state) {
  const base = {
    flex: 1,
    minHeight: 0,
    width: '100%',
    borderRadius: '3px',
    transition: 'background .09s linear, box-shadow .09s linear, opacity .09s',
  };
  if (state === 'lit')
    return {
      ...base,
      background: 'linear-gradient(90deg,#C9962A,#F5C84B 45%,#FFF6D8 50%,#F5C84B 55%,#C9962A)',
      boxShadow: '0 0 8px 1px rgba(245,200,75,.65)',
    };
  if (state === 'flare')
    return {
      ...base,
      background: 'linear-gradient(90deg,#F5C84B,#FFFFFF 50%,#F5C84B)',
      boxShadow: '0 0 16px 3px rgba(255,214,96,.95)',
    };
  return {
    ...base,
    background: '#17160f',
    boxShadow: 'inset 0 0 4px rgba(0,0,0,.8)',
    opacity: 0.5,
  };
}

export default function Lightboard({ count = 100, mode = 'full', flare = false }) {
  const rows = [];
  for (let i = 0; i < 100; i++) {
    const v = 99 - i; // top row = 99, bottom row = 0
    let st;
    if (mode === 'full') st = 'lit';
    else if (flare) st = 'flare';
    else st = v < count ? 'lit' : 'off';
    rows.push(<div key={`r${i}`} style={rowStyle(st)} />);
  }
  return (
    <div
      style={{
        flex: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        paddingRight: 'clamp(14px,2vw,34px)',
      }}
    >
      <div
        style={{
          fontFamily: "'Cairo'",
          fontWeight: 700,
          color: '#6b6557',
          fontSize: 'clamp(12px,1.1vw,15px)',
          letterSpacing: '3px',
        }}
      >
        ١٠٠
      </div>
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(1px,.18vh,3px)',
          width: 'clamp(120px,12vw,190px)',
          flex: 1,
          minHeight: 0,
          maxHeight: '760px',
          padding: 'clamp(8px,1vw,14px)',
          background:
            'linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01))',
          border: '1px solid rgba(245,200,75,.18)',
          borderRadius: '16px',
          boxShadow: 'inset 0 0 60px rgba(0,0,0,.6)',
        }}
      >
        {rows}
      </div>
      <div
        style={{
          fontFamily: "'Cairo'",
          fontWeight: 700,
          color: '#6b6557',
          fontSize: 'clamp(12px,1.1vw,15px)',
          letterSpacing: '3px',
        }}
      >
        صِفر
      </div>
    </div>
  );
}
