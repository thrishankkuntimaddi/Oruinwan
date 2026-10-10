// One icon family (lucide), one stroke width, three sizes. Use this instead of raw icons.
const SIZES = { sm: 16, md: 20, lg: 24 };

export function Icon({ as: Glyph, size = 'md', className, ...rest }) {
  const px = typeof size === 'number' ? size : SIZES[size];
  return <Glyph size={px} strokeWidth={1.75} className={className} aria-hidden="true" focusable="false" {...rest} />;
}
