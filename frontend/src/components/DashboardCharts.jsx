import React from 'react';

/**
 * Modern SVG Donut Chart for Category Distribution
 */
export function DonutChart({ data = [], totalUnits = 0 }) {
  if (!data || data.length === 0 || totalUnits === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        No category distribution data available
      </div>
    );
  }

  const colors = [
    '#6366f1', // Indigo
    '#38bdf8', // Sky
    '#34d399', // Emerald
    '#f59e0b', // Amber
    '#ec4899', // Pink
    '#a855f7'  // Purple
  ];

  let cumulativePercent = 0;
  const radius = 68;
  const strokeWidth = 26;
  const circumference = 2 * Math.PI * radius;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
      <div style={{ position: 'relative', width: '180px', height: '180px' }}>
        <svg viewBox="0 0 180 180" width="180" height="180" style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx="90"
            cy="90"
            r={radius}
            fill="transparent"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth={strokeWidth}
          />
          {data.map((item, idx) => {
            const percent = (item.total_stock / totalUnits) * 100;
            const strokeDasharray = `${(percent / 100) * circumference} ${circumference}`;
            const strokeDashoffset = -((cumulativePercent / 100) * circumference);
            cumulativePercent += percent;
            const color = colors[idx % colors.length];

            return (
              <circle
                key={item.category || idx}
                cx="90"
                cy="90"
                r={radius}
                fill="transparent"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{
                  transition: 'stroke-dasharray 0.5s ease, stroke-dashoffset 0.5s ease',
                  cursor: 'pointer'
                }}
              >
                <title>{`${item.category}: ${item.total_stock} units (${percent.toFixed(1)}%)`}</title>
              </circle>
            );
          })}
        </svg>

        {/* Center label */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          pointerEvents: 'none'
        }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', fontFamily: 'var(--font-heading)' }}>
            {totalUnits}
          </div>
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-subtle)', fontWeight: 600 }}>
            Total Units
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem', width: '100%' }}>
        {data.map((item, idx) => {
          const color = colors[idx % colors.length];
          const percent = totalUnits > 0 ? ((item.total_stock / totalUnits) * 100).toFixed(1) : 0;
          return (
            <div key={item.category} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, display: 'inline-block' }} />
              <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.category}>
                {item.category}:
              </span>
              <strong style={{ color: '#fff', marginLeft: 'auto' }}>{percent}%</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Modern SVG / CSS Bar Chart for Stock by Warehouse
 */
export function WarehouseBarChart({ data = [] }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        No warehouse stock data available
      </div>
    );
  }

  const maxStock = Math.max(...data.map(d => Number(d.total_stock) || 0), 10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', padding: '0.5rem 0' }}>
      {data.map(item => {
        const stock = Number(item.total_stock) || 0;
        const percent = Math.min(Math.round((stock / maxStock) * 100), 100);

        return (
          <div key={item.warehouse_id} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem' }}>
              <span style={{ fontWeight: 600, color: '#f8fafc' }}>
                {item.warehouse_name}
                <span style={{ color: 'var(--text-subtle)', marginLeft: '0.4rem', fontSize: '0.75rem' }}>({item.warehouse_code})</span>
              </span>
              <span style={{ fontWeight: 700, color: '#38bdf8' }}>
                {stock} units <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({item.product_count} products)</span>
              </span>
            </div>

            <div style={{
              width: '100%',
              height: '10px',
              background: 'rgba(255, 255, 255, 0.06)',
              borderRadius: '9999px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${percent}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #38bdf8, #6366f1)',
                borderRadius: '9999px',
                transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Modern SVG Area / Trend Chart for Stock Movements Over Time
 */
export function MovementTrendChart({ timeline = [] }) {
  if (!timeline || timeline.length === 0) {
    return (
      <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📈</div>
        <div>No movement history recorded in this time range.</div>
      </div>
    );
  }

  const height = 150;
  const width = 500;
  const padding = 25;

  const maxVal = Math.max(...timeline.map(t => Math.max(t.stock_in, t.stock_out)), 10);

  const getX = (idx) => {
    if (timeline.length === 1) return width / 2;
    return padding + (idx / (timeline.length - 1)) * (width - 2 * padding);
  };

  const getY = (val) => {
    return height - padding - ((val / maxVal) * (height - 2 * padding));
  };

  const pointsIn = timeline.map((t, idx) => `${getX(idx)},${getY(t.stock_in)}`).join(' ');
  const pointsOut = timeline.map((t, idx) => `${getX(idx)},${getY(t.stock_out)}`).join(' ');

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <div style={{ minWidth: '450px' }}>
        <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '0.75rem', fontSize: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '10px', height: '10px', background: '#10b981', borderRadius: '2px' }} />
            <span style={{ color: 'var(--text-muted)' }}>Stock In (Receipts / Adjustments)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '2px' }} />
            <span style={{ color: 'var(--text-muted)' }}>Stock Out (Deliveries / Reductions)</span>
          </div>
        </div>

        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
          {/* Subtle grid lines */}
          <line x1={padding} y1={getY(0)} x2={width - padding} y2={getY(0)} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          <line x1={padding} y1={getY(maxVal / 2)} x2={width - padding} y2={getY(maxVal / 2)} stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
          <line x1={padding} y1={getY(maxVal)} x2={width - padding} y2={getY(maxVal)} stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />

          {/* Stock In Polyline */}
          <polyline
            fill="none"
            stroke="#10b981"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={pointsIn}
          />

          {/* Stock Out Polyline */}
          <polyline
            fill="none"
            stroke="#ef4444"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={pointsOut}
          />

          {/* Points for Stock In */}
          {timeline.map((t, idx) => (
            <circle
              key={`in-${idx}`}
              cx={getX(idx)}
              cy={getY(t.stock_in)}
              r="4"
              fill="#10b981"
              stroke="#0f172a"
              strokeWidth="2"
            >
              <title>{`${t.date_label}: +${t.stock_in} units in`}</title>
            </circle>
          ))}

          {/* Points for Stock Out */}
          {timeline.map((t, idx) => (
            <circle
              key={`out-${idx}`}
              cx={getX(idx)}
              cy={getY(t.stock_out)}
              r="4"
              fill="#ef4444"
              stroke="#0f172a"
              strokeWidth="2"
            >
              <title>{`${t.date_label}: -${t.stock_out} units out`}</title>
            </circle>
          ))}

          {/* Date labels on bottom */}
          {timeline.map((t, idx) => (
            <text
              key={`label-${idx}`}
              x={getX(idx)}
              y={height - 5}
              textAnchor="middle"
              fill="var(--text-subtle)"
              fontSize="9"
              fontFamily="var(--font-body)"
            >
              {t.date_label.slice(5)}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
