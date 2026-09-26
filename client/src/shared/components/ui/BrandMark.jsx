import React from 'react';
import BRAND from '../../brand';

// Oruinwan logo. Uses a downscaled copy of public/icons/Oruinwan.png; the
// 512px variant is picked on high-density screens for large sizes.
const BrandMark = ({ size = 28, title = BRAND.name, className, style }) => (
    <img
        src="/icons/oruinwan-128.png"
        srcSet="/icons/oruinwan-128.png 1x, /icons/oruinwan-512.png 4x"
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
