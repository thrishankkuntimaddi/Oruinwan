import React from 'react';
import { Section } from './settingsUi';

/** Legacy name for the Settings section card; use `Section` from settingsUi in new code. */
const Card = ({ title, subtitle, action, children }) => (
    <Section title={title} description={subtitle} action={action} pad>{children}</Section>
);

export default Card;
