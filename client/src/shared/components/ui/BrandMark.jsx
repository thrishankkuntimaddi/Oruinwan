import React from 'react';
import BRAND from '../../brand';

// Oruinwan logo on a transparent background (works on light and dark). The 512px
// variant is picked on high-density screens for large sizes. The square app icons
// (oruinwan-192/512.png) keep their dark tile for home screens and notifications.
const BrandMark = ({ size = 28, title = BRAND.name, className, style }) => (
    <img
        src={`${import.meta.env.BASE_URL}icons/oruinwan-128.png`}
        srcSet={`${import.meta.env.BASE_URL}icons/oruinwan-128.png 1x, ${import.meta.env.BASE_URL}icons/oruinwan-mark-512.png 4x`}
        width={size}
        height={size}
        alt={title || ''}
        aria-hidden={title ? undefined : true}
        draggable={false}
        className={className}
        style={{ display: 'block', flexShrink: 0, objectFit: 'contain', ...style }}
    />
);

export default BrandMark;
