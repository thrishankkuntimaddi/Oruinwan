import React, { useState } from 'react';
import { FAQ as ITEMS } from './data';

const FAQ = () => {
    const [open, setOpen] = useState(0);
    return (
        <div className="orw-faq" data-reveal>
            {ITEMS.map((item, i) => {
                const isOpen = open === i;
                return (
                    <div className="orw-faq__item" key={item.q}>
                        <h3>
                            <button type="button" className="orw-faq__q" id={`orw-faq-q-${i}`}
                                aria-expanded={isOpen} aria-controls={`orw-faq-a-${i}`}
                                onClick={() => setOpen(isOpen ? -1 : i)}>
                                {item.q}
                                <span className="orw-faq__sign" aria-hidden="true" />
                            </button>
                        </h3>
                        <div className={`orw-faq__a${isOpen ? ' is-open' : ''}`} id={`orw-faq-a-${i}`}
                            role="region" aria-labelledby={`orw-faq-q-${i}`} inert={!isOpen}>
                            <div><p>{item.a}</p></div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default FAQ;
