import { Link } from 'react-router-dom';
import { TITLE_GRAD, GOLD_GRAD, C } from '../theme.js';
import { firebaseReady } from '../firebase.js';

export default function Home() {
  return (
    <div
      dir="rtl"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background:
          'radial-gradient(ellipse 80% 60% at 50% 25%,rgba(245,200,75,.10),transparent 62%),#08080c',
        overflow: 'auto',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 560, width: '100%' }}>
        <div
          style={{
            fontFamily: "'Cairo'",
            fontWeight: 900,
            fontSize: 'clamp(80px,18vw,180px)',
            lineHeight: 0.9,
            animation: 'glowBreath 3.6s ease-in-out infinite',
            background: TITLE_GRAD,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          صِفر
        </div>
        <div
          style={{
            marginTop: 14,
            fontSize: 'clamp(18px,4vw,26px)',
            fontWeight: 700,
            color: C.cream3,
          }}
        >
          أندرُ إجابة… أعلى فوز
        </div>
        <div style={{ marginTop: 10, color: C.mute, fontSize: 14, lineHeight: 1.7 }}>
          لعبة معلومات جماعية بأسلوب «Pointless». المُضيف يفتح لوحة التحكّم على جواله،
          وشخصٌ آخر يفتح شاشة العرض ويعكسها على التلفاز.
        </div>

        <div
          style={{
            marginTop: 32,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <Link
            to="/admin"
            style={{
              display: 'block',
              padding: '18px',
              borderRadius: 14,
              textDecoration: 'none',
              background: GOLD_GRAD,
              color: '#2a2008',
              fontFamily: "'Cairo'",
              fontWeight: 900,
              fontSize: 20,
              boxShadow: '0 10px 30px rgba(245,200,75,.32)',
            }}
          >
            ▶ لوحة التحكّم (المُضيف)
          </Link>
          <Link
            to="/display"
            style={{
              display: 'block',
              padding: '18px',
              borderRadius: 14,
              textDecoration: 'none',
              background: C.panel2,
              border: '1px solid rgba(245,200,75,.3)',
              color: C.goldSoft,
              fontFamily: "'Cairo'",
              fontWeight: 900,
              fontSize: 20,
            }}
          >
            📺 شاشة العرض (التلفاز)
          </Link>
        </div>

        {!firebaseReady && (
          <div
            style={{
              marginTop: 26,
              padding: '14px 16px',
              borderRadius: 12,
              border: '1px solid rgba(255,90,90,.3)',
              background: 'rgba(255,90,90,.08)',
              color: C.danger3,
              fontSize: 13,
              lineHeight: 1.7,
              textAlign: 'right',
            }}
          >
            ⚠️ لم يتم ضبط إعدادات Firebase بعد. المزامنة اللحظية بين الجهازين لن تعمل
            حتى تُنشئ ملف <code style={{ color: C.goldSoft }}>.env.local</code>. راجع
            ملف <code style={{ color: C.goldSoft }}>README</code>.
          </div>
        )}
      </div>
    </div>
  );
}
