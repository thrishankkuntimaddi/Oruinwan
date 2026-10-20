import React from 'react';
import BRAND from '../../brand';

// The app's loading screen: logo, name and a thin gold progress bar. index.html paints the same
// markup before the bundle arrives (its styles live there too, so they apply before any CSS
// loads); this component keeps it on screen while the app is still loading data, e.g. the
// signed-in user. It never adds a delay of its own.
const LoadingScreen = ({ label = `Loading ${BRAND.name}` }) => (
    <div className="orw-boot" role="status" aria-live="polite">
        <div className="orw-boot__brand">
            <img className="orw-boot__logo" src={`${import.meta.env.BASE_URL}icons/oruinwan-128.png`} width="44" height="44" alt="" draggable={false} />
            <span className="orw-boot__word">{BRAND.name}</span>
        </div>
        <div className="orw-boot__bar" aria-hidden="true" />
        <span className="orw-boot__sr">{label}</span>
    </div>
);

export default LoadingScreen;
