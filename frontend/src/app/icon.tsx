import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Shadow layer */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 26,
            height: 26,
            borderRadius: 7,
            background: '#93c5fd',
            opacity: 0.5,
          }}
        />
        {/* White card */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 26,
            height: 26,
            borderRadius: 7,
            background: 'white',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          }}
        >
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2, marginTop: -4 }}>
            {[0,1,2].map((i) => (
              <div key={i} style={{ width: 2, height: 5, borderRadius: 2, background: '#60a5fa' }} />
            ))}
          </div>
          {/* Grid */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, width: 14 }}>
            {[0,1,2,3,4,5].map((i) => (
              <div key={i} style={{ width: 3, height: 3, borderRadius: 1, background: '#e5e7eb' }} />
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
