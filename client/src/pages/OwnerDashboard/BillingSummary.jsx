import React from 'react';
import { CreditCard, Users, CalendarClock } from 'lucide-react';
import { KpiGrid, Kpi, Panel, Meter } from '../../components/company-dash/dashUi';

const money = (n, currency = 'USD') => {
    if (n == null || Number.isNaN(Number(n))) return null;
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n); } catch { return `${n} ${currency}`; }
};
const title = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : s);

/**
 * Plan, seats and renewal from GET /api/owner-dashboard/billing-summary.
 * `seatLimit` (company.settings.maxUsers) overrides the server's seat total when known.
 */
const BillingSummary = ({ data, loading, seatLimit }) => {
    const used = data?.seatUsage?.used;
    const total = seatLimit || data?.seatUsage?.total;
    const pct = used != null && total ? Math.round((used / total) * 100) : null;
    return (
        <KpiGrid>
            <Kpi label="Current plan" icon={CreditCard} value={loading ? undefined : title(data?.currentPlan)} loading={loading} hint={data?.monthlyCost ? `${money(data.monthlyCost)} per month` : 'no charges on record'} />
            <Panel>
                <div className="cd-kpi-top" style={{ marginBottom: 6 }}>
                    <span className="cd-kpi-label">Seats</span>
                    <span className="cd-kpi-icon"><Users size={14} /></span>
                </div>
                <div className="cd-kpi-value" style={{ marginBottom: 10 }}>
                    {loading ? '…' : used == null ? '—' : `${used}${total ? ` / ${total}` : ''}`}
                </div>
                <Meter value={pct || 0} label="Seat usage" tone={pct >= 90 ? 'danger' : undefined} />
                <div className="cd-kpi-hint" style={{ marginTop: 8 }}>{pct == null ? 'seat limit unknown' : `${pct}% of seats in use`}</div>
            </Panel>
            <Kpi
                label="Renews"
                icon={CalendarClock}
                value={loading ? undefined : data?.renewalDate ? new Date(data.renewalDate).toLocaleDateString() : 'Not scheduled'}
                loading={loading}
                hint="next billing date"
            />
        </KpiGrid>
    );
};

export { money };
export default BillingSummary;
