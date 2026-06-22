// 100-segment lightboard tower for the Display screen.
// Cells are laid out 5 across × 20 down; value v = (19 - row) * 5 + col, so the
// board fills from the bottom up. Cells with v < count stay lit.

function dotStyle(state) {
  const base = {
    width: '100%',
    aspectRatio: '1',
    borderRadius: '50%',
    transition: 'background .1s linear, box-shadow .1s linear, opacity .1s',
  };
  if (state === 'lit')
    return {
      ...base,
      background: 'radial-gradient(circle at 35% 30%,#FFF6D8,#F5C84B 55%,#C9962A)',
      boxShadow: '0 0 9px 1px rgba(245,200,75,.7)',
    };
  if (state === 'flare')
    return {
      ...base,
      background: 'radial-gradient(circle at 35% 30%,#FFFFFF,#FFE49A 50%,#F5C84B)',
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
  const cells = [];
  for (let r = 0; r < 20; r++) {
    for (let col = 0; col < 5; col++) {
      const v = (19 - r) * 5 + col;
      let st;
      if (mode === 'full') st = 'lit';
      else if (flare) st = 'flare';
      else st = v < count ? 'lit' : 'off';
      cells.push(<div key={`c${r}_${col}`} style={dotStyle(st)} />);
    }
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
          display: 'grid',
          gridTemplateColumns: 'repeat(5,1fr)',
          gap: 'clamp(5px,.7vw,9px)',
          width: 'clamp(140px,14vw,210px)',
          flex: 1,
          minHeight: 0,
          maxHeight: '760px',
          alignContent: 'stretch',
          padding: 'clamp(10px,1.2vw,16px)',
          background:
            'linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01))',
          border: '1px solid rgba(245,200,75,.18)',
          borderRadius: '20px',
          boxShadow: 'inset 0 0 60px rgba(0,0,0,.6)',
        }}
      >
        {cells}
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
