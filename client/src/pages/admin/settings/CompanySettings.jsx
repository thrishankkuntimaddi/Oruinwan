import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import CompanyProfile from './sections/CompanyProfile';
import DomainSSO from './sections/DomainSSO';
import SamlSSO from './sections/SamlSSO';
import Backups from './sections/Backups';
import { useCompany } from '../../../contexts/CompanyContext';
import { DashPage, PageHead, FilterTabs, LoadingState, ErrorState } from '../../../components/company-dash/dashUi';

/*
 * Only sections backed by a working API are listed. The former Security,
 * Notifications, Billing, User defaults, Branding and Data & privacy tabs
 * saved nothing (toast only / "coming soon") and were removed from the nav.
 */
const SECTIONS = [
    { value: 'profile', label: 'Profile', component: CompanyProfile },
    { value: 'domain', label: 'Domain', component: DomainSSO },
    { value: 'sso', label: 'Single sign-on', component: SamlSSO },
    { value: 'backups', label: 'Backups', component: Backups },
];

const CompanySettings = () => {
    const { company, loading, error, refreshCompanyData } = useCompany();
    const [active, setActive] = useState('profile');
    const Active = SECTIONS.find((s) => s.value === active)?.component;

    return (
        <DashPage
            head={(
                <PageHead
                    eyebrow="Owner console"
                    icon={Settings}
                    title="Company settings"
                    lead="Your company's profile, email domain, single sign-on and backups"
                    actions={<FilterTabs label="Settings section" value={active} onChange={setActive} options={SECTIONS} />}
                />
            )}
        >
            {loading && !company ? <LoadingState />
                : error && !company ? <ErrorState message={error} onRetry={refreshCompanyData} />
                    : Active && <Active />}
        </DashPage>
    );
};

export default CompanySettings;
