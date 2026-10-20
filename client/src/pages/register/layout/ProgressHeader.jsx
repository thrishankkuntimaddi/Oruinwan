import React from 'react';

export const STEPS = [
    { title: 'Your company', short: 'Name and web domain', lead: 'Tell us which company you’re registering. The domain must match your work email.' },
    { title: 'About you', short: 'Contact details', lead: 'You’ll be the first admin. We use these details to reach you about the review.' },
    { title: 'Your sign-in', short: 'Work email and password', lead: 'This is how you’ll sign in. The password also unlocks your encrypted messages.' },
    { title: 'Proof of company', short: 'One document', lead: 'Upload one document that shows the company is real. Only our review team sees it.' },
    { title: 'Review and submit', short: 'Check everything', lead: 'Check your details. Select a section to change it before you submit.' },
];

/** Five-segment progress bar + the current step's head. */
const ProgressHeader = ({ currentStep }) => {
    const step = STEPS[currentStep - 1] || STEPS[0];
    return (
        <>
            <ol className="orw-stepper orw-stepper--5" aria-label={`Step ${currentStep} of ${STEPS.length}`}>
                {STEPS.map((s, i) => {
                    const n = i + 1;
                    return (
                        <li key={s.title} className={`orw-stepper__item${n < currentStep ? ' is-done' : n === currentStep ? ' is-current' : ''}`}>
                            <span className="orw-stepper__bar" />
                        </li>
                    );
                })}
            </ol>
            <div className="orw-auth__panel-head">
                <p className="orw-eyebrow">Step {currentStep} of {STEPS.length}</p>
                <h2>{step.title}</h2>
                <p>{step.lead}</p>
            </div>
        </>
    );
};

export default ProgressHeader;
