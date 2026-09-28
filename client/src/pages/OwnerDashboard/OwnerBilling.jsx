import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, RefreshCw, Receipt, Mail, LifeBuoy, Wallet } from 'lucide-react';
import api from '@services/api';
import { useCompany } from '../../contexts/CompanyContext';
import { getBillingSummary } from '../../services/ownerDashboardService';
import BillingSummary, { money } from './BillingSummary';
import {
    DashPage, PageHead, Section, Grid, Panel, KpiGrid, Kpi, Btn, Chip, DataTable, Dialog,
    ErrorState, EmptyState, LoadingState, useAsync,
} from '../../components/company-dash/dashUi';
import './owner.css';

const STATUS_TONE = { paid: 'success', pending: 'warning', failed: 'danger', refunded: undefined, cancelled: undefined };
const DAY = 864e5;

/** Owner billing (behind the `billing` feature flag): plan, seats, invoices — nothing invented. */
const OwnerBilling = () => {
    const navigate = useNavigate();
    const { company } = useCompany();
    const [openInvoice, setOpenInvoice] = useState(null);

    const summary = useAsync(() => getBillingSummary(), []);
    const invoices = useAsync(() => api.get('/api/owner-dashboard/invoices', { params: { limit: 50 } }).then((r) => r.data.invoices || []), []);
    const payment = useAsync(() => api.get('/api/owner-dashboard/payment-methods').then((r) => r.data.paymentMethod || null), []);

    const spend = useMemo(() => {
        const list = (invoices.data || []).filter((i) => i.status === 'paid');
        const since = (ms) => list.filter((i) => new Date(i.paidDate || i.issueDate).getTime() >= Date.now() - ms).reduce((s, i) => s + (i.amount || 0), 0);
        const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
        return {
            month: since(30 * DAY),
            quarter: since(90 * DAY),
            ytd: list.filter((i) => new Date(i.paidDate || i.issueDate).getTime() >= yearStart).reduce((s, i) => s + (i.amount || 0), 0),
            currency: list[0]?.currency || 'USD',
        };
    }, [invoices.data]);

    const refresh = () => { summary.reload(); invoices.reload(); payment.reload(); };
    const contact = summary.data?.billingContact || {};

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="Owner console"
                    icon={CreditCard}
                    title="Billing & plan"
                    lead="Subscription, seats and invoices for your company"
                    actions={(
                        <>
                            <Btn icon={LifeBuoy} onClick={() => navigate('/contact-admin')}>Change plan</Btn>
                            <Btn icon={RefreshCw} onClick={refresh}>Refresh</Btn>
                        </>
                    )}
                />
            )}
        >
            {summary.error ? <ErrorState message={summary.error} onRetry={summary.reload} />
                : <BillingSummary data={summary.data} loading={summary.loading} seatLimit={company?.settings?.maxUsers} />}

            <Section title="Spending" lead="Totals of paid invoices">
                <KpiGrid>
                    <Kpi label="Last 30 days" icon={Wallet} value={invoices.loading ? undefined : money(spend.month, spend.currency)} loading={invoices.loading} />
                    <Kpi label="Last 90 days" icon={Wallet} value={invoices.loading ? undefined : money(spend.quarter, spend.currency)} loading={invoices.loading} />
                    <Kpi label="Year to date" icon={Wallet} value={invoices.loading ? undefined : money(spend.ytd, spend.currency)} loading={invoices.loading} />
                </KpiGrid>
            </Section>

            <Section title="Invoices">
                {invoices.loading ? <LoadingState /> : invoices.error ? <ErrorState message={invoices.error} onRetry={invoices.reload} /> : (
                    <DataTable
                        caption="Invoices"
                        rows={invoices.data || []}
                        rowKey={(i) => i._id || i.invoiceNumber}
                        onRowClick={setOpenInvoice}
                        empty={<EmptyState icon={Receipt} title="No invoices yet" text="Invoices appear here once your company is billed." />}
                        columns={[
                            { key: 'invoiceNumber', label: 'Invoice', render: (i) => <span className="od-mono">{i.invoiceNumber}</span> },
                            { key: 'issueDate', label: 'Issued', render: (i) => (i.issueDate ? new Date(i.issueDate).toLocaleDateString() : '—') },
                            { key: 'plan', label: 'Plan', className: 'cd-hide-sm', render: (i) => i.planName || i.planType },
                            { key: 'amount', label: 'Amount', className: 'cd-num', render: (i) => money(i.amount, i.currency) },
                            { key: 'status', label: 'Status', render: (i) => <Chip tone={STATUS_TONE[i.status]}>{i.status}</Chip> },
                        ]}
                    />
                )}
            </Section>

            <Grid cols="2">
                <Panel title="Payment method" icon={CreditCard}>
                    {payment.loading ? <LoadingState /> : payment.error ? <span className="cd-error-text">{payment.error}</span> : payment.data?.last4 ? (
                        <div className="od-kv">
                            <div className="od-kv-row"><span>Card</span><span>{payment.data.brand ? `${payment.data.brand} ` : ''}•••• {payment.data.last4}</span></div>
                            {payment.data.expiryMonth && <div className="od-kv-row"><span>Expires</span><span>{payment.data.expiryMonth}/{payment.data.expiryYear}</span></div>}
                        </div>
                    ) : <p className="cd-muted" style={{ margin: 0, fontSize: 13 }}>No payment method on file.</p>}
                </Panel>
                <Panel title="Billing contact" icon={Mail}>
                    <div className="od-kv">
                        <div className="od-kv-row"><span>Email</span><span>{summary.loading ? '…' : contact.email || 'Not set'}</span></div>
                        <div className="od-kv-row"><span>Address</span><span>{summary.loading ? '…' : contact.address || 'Not set'}</span></div>
                    </div>
                </Panel>
            </Grid>

            <Dialog
                open={!!openInvoice}
                title={openInvoice ? `Invoice ${openInvoice.invoiceNumber}` : ''}
                lead={openInvoice?.planName}
                onClose={() => setOpenInvoice(null)}
                footer={<Btn onClick={() => setOpenInvoice(null)}>Close</Btn>}
            >
                {openInvoice && (
                    <div className="od-kv">
                        <div className="od-kv-row"><span>Status</span><span><Chip tone={STATUS_TONE[openInvoice.status]}>{openInvoice.status}</Chip></span></div>
                        <div className="od-kv-row"><span>Amount</span><span>{money(openInvoice.amount, openInvoice.currency)}</span></div>
                        <div className="od-kv-row"><span>Issued</span><span>{openInvoice.issueDate ? new Date(openInvoice.issueDate).toLocaleDateString() : '—'}</span></div>
                        <div className="od-kv-row"><span>Due</span><span>{openInvoice.dueDate ? new Date(openInvoice.dueDate).toLocaleDateString() : '—'}</span></div>
                        {openInvoice.paidDate && <div className="od-kv-row"><span>Paid</span><span>{new Date(openInvoice.paidDate).toLocaleDateString()}</span></div>}
                        {openInvoice.billingPeriod?.start && (
                            <div className="od-kv-row"><span>Period</span><span>{new Date(openInvoice.billingPeriod.start).toLocaleDateString()} – {openInvoice.billingPeriod.end ? new Date(openInvoice.billingPeriod.end).toLocaleDateString() : '…'}</span></div>
                        )}
                        <div className="od-kv-row"><span>Seats</span><span>{openInvoice.seatsUsed ?? '—'} / {openInvoice.seatsIncluded ?? '—'}</span></div>
                        {(openInvoice.lineItems || []).map((li, idx) => (
                            <div key={idx} className="od-kv-row"><span>{li.description} × {li.quantity}</span><span>{money(li.amount, openInvoice.currency)}</span></div>
                        ))}
                    </div>
                )}
            </Dialog>
        </DashPage>
    );
};

export default OwnerBilling;
