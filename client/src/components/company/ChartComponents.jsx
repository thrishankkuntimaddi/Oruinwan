import React from 'react';
import { Kpi } from '../company-dash/dashUi';

export const LineChart = ({ data, height = 200, color = 'var(--accent)', showDots = true }) => {
    if (!data || data.length === 0) {
        return <div className="flex items-center justify-center h-48 cd-muted">No data available</div>;
    }

    const maxValue = Math.max(...data.map(d => d.value), 1);
    const width = 100; 
    const padding = 10;

    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
        const y = height - ((d.value / maxValue) * (height - padding * 2) + padding);
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="relative w-full" style={{ height: `${height}px` }}>
            <svg width="100%" height={height} className="overflow-visible">
                {}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
                    <line
                        key={i}
                        x1="0"
                        y1={height - ratio * (height - padding * 2) - padding}
                        x2="100%"
                        y2={height - ratio * (height - padding * 2) - padding}
                        stroke="var(--border-default)"
                        strokeWidth="1"
                        strokeDasharray="4"
                    />
                ))}

                {}
                <polyline
                    points={points}
                    fill="none"
                    stroke={color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {}
                <polygon
                    points={`${padding},${height} ${points} ${width - padding},${height}`}
                    fill={color}
                    fillOpacity="0.1"
                />

                {}
                {showDots && data.map((d, i) => {
                    const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
                    const y = height - ((d.value / maxValue) * (height - padding * 2) + padding);
                    return (
                        <circle
                            key={i}
                            cx={`${x}%`}
                            cy={y}
                            r="4"
                            fill="var(--bg-surface)"
                            stroke={color}
                            strokeWidth="2"
                            className="hover:r-6 transition-all cursor-pointer"
                        >
                            <title>{`${d.date || d.label}: ${d.value}`}</title>
                        </circle>
                    );
                })}
            </svg>

            {}
            <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs cd-muted -ml-8">
                <span>{maxValue}</span>
                <span>{Math.round(maxValue * 0.5)}</span>
                <span>0</span>
            </div>
        </div>
    );
};

export const BarChart = ({ data, height = 200, color = 'var(--accent)' }) => {
    if (!data || data.length === 0) {
        return <div className="flex items-center justify-center h-48 cd-muted">No data available</div>;
    }

    const maxValue = Math.max(...data.map(d => d.value), 1);

    return (
        <div className="w-full" style={{ height: `${height}px` }}>
            <div className="flex items-end justify-between h-full gap-2">
                {data.map((item, index) => {
                    const barHeight = (item.value / maxValue) * 100;
                    return (
                        <div key={index} className="flex-1 flex flex-col items-center group">
                            <div className="w-full flex flex-col items-center justify-end h-full">
                                <div className="text-xs font-semibold  mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {item.value}
                                </div>
                                <div
                                    className="w-full rounded-t-lg transition-all duration-300 hover:opacity-80 cursor-pointer"
                                    style={{
                                        height: `${barHeight}%`,
                                        backgroundColor: color,
                                        minHeight: item.value > 0 ? '4px' : '0'
                                    }}
                                    title={`${item.label}: ${item.value}`}
                                />
                            </div>
                            <div className="text-xs cd-muted mt-2 text-center truncate w-full">
                                {item.label}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export const PieChart = ({ data, size = 200 }) => {
    if (!data || data.length === 0) {
        return <div className="flex items-center justify-center h-48 cd-muted">No data available</div>;
    }

    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) {
        return <div className="flex items-center justify-center h-48 cd-muted">No data available</div>;
    }

    const colors = ['var(--accent)', 'var(--state-success)', 'var(--color-warning)', 'var(--state-danger)', 'var(--text-secondary)', 'var(--border-accent)'];
    let currentAngle = -90; 

    const slices = data.map((item, index) => {
        const percentage = (item.value / total) * 100;
        const angle = (percentage / 100) * 360;
        const startAngle = currentAngle;
        const endAngle = currentAngle + angle;
        currentAngle = endAngle;

        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;

        const x1 = size / 2 + (size / 2 - 10) * Math.cos(startRad);
        const y1 = size / 2 + (size / 2 - 10) * Math.sin(startRad);
        const x2 = size / 2 + (size / 2 - 10) * Math.cos(endRad);
        const y2 = size / 2 + (size / 2 - 10) * Math.sin(endRad);

        const largeArc = angle > 180 ? 1 : 0;

        const pathData = [
            `M ${size / 2} ${size / 2}`,
            `L ${x1} ${y1}`,
            `A ${size / 2 - 10} ${size / 2 - 10} 0 ${largeArc} 1 ${x2} ${y2}`,
            'Z'
        ].join(' ');

        return {
            path: pathData,
            color: colors[index % colors.length],
            label: item.label,
            value: item.value,
            percentage: percentage.toFixed(1)
        };
    });

    return (
        <div className="flex items-center gap-6">
            <svg width={size} height={size} className="flex-shrink-0">
                {slices.map((slice, index) => (
                    <path
                        key={index}
                        d={slice.path}
                        fill={slice.color}
                        className="hover:opacity-80 transition-opacity cursor-pointer"
                        title={`${slice.label}: ${slice.value} (${slice.percentage}%)`}
                    />
                ))}
            </svg>
            <div className="flex flex-col gap-2">
                {slices.map((slice, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                        <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: slice.color }}
                        />
                        <span className="">{slice.label}</span>
                        <span className="cd-muted ml-auto">{slice.percentage}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const AreaChart = ({ data, height = 200, color = 'var(--state-success)' }) => {
    if (!data || data.length === 0) {
        return <div className="flex items-center justify-center h-48 cd-muted">No data available</div>;
    }

    const maxValue = Math.max(...data.map(d => d.value), 1);
    const width = 100;
    const padding = 10;

    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
        const y = height - ((d.value / maxValue) * (height - padding * 2) + padding);
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="relative w-full" style={{ height: `${height}px` }}>
            <svg width="100%" height={height} className="overflow-visible">
                {}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
                    <line
                        key={i}
                        x1="0"
                        y1={height - ratio * (height - padding * 2) - padding}
                        x2="100%"
                        y2={height - ratio * (height - padding * 2) - padding}
                        stroke="var(--border-default)"
                        strokeWidth="1"
                        strokeDasharray="4"
                    />
                ))}

                {}
                <polygon
                    points={`${padding},${height} ${points} ${width - padding},${height}`}
                    fill={color}
                    fillOpacity="0.3"
                />

                {}
                <polyline
                    points={points}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>

            {}
            <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs cd-muted -ml-8">
                <span>{maxValue}</span>
                <span>{Math.round(maxValue * 0.5)}</span>
                <span>0</span>
            </div>
        </div>
    );
};

export const StatCard = ({ label, value, trend, icon }) => (
    <Kpi
        icon={icon}
        label={label}
        value={value}
        delta={trend !== undefined && trend !== null ? `${trend >= 0 ? '+' : ''}${trend}%` : undefined}
        deltaTone={trend >= 0 ? 'up' : 'down'}
        hint={trend !== undefined && trend !== null ? 'vs last period' : undefined}
    />
);
