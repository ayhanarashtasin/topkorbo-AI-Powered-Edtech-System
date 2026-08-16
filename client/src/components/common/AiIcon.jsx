import React from 'react';

/**
 * AiIcon - Cybernetic AI Avatar / Icon Component
 * Renders the custom AI vector icon with configurable size, colors, and styling.
 */
export default function AiIcon({
  size = '1em',
  width,
  height,
  color,
  primaryColor,
  secondaryColor,
  themeColors = false,
  className = '',
  style = {},
  ...props
}) {
  const iconWidth = width || size;
  const iconHeight = height || size;

  const pColor = primaryColor || (themeColors ? 'var(--dark-blue, currentColor)' : (color || 'currentColor'));
  const sColor = secondaryColor || (themeColors ? 'var(--text-primary, currentColor)' : (color || 'currentColor'));

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={iconWidth}
      height={iconHeight}
      className={`ai-custom-icon ${className}`.trim()}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        ...style
      }}
      aria-hidden="true"
      {...props}
    >
      {/* Outer head silhouette traces */}
      <path d="M30 18 L22 28 L22 42" stroke={pColor} strokeWidth="2.5" />
      <circle cx="30" cy="18" r="3" fill={pColor} />

      <path d="M18 48 L15 54 L25 68 L32 78" stroke={pColor} strokeWidth="2.5" />
      <circle cx="18" cy="48" r="3" fill={pColor} />

      <path d="M70 18 L78 28 L78 42" stroke={pColor} strokeWidth="2.5" />
      <circle cx="70" cy="18" r="3" fill={pColor} />

      <path d="M82 48 L85 54 L75 68 L68 78" stroke={pColor} strokeWidth="2.5" />
      <circle cx="82" cy="48" r="3" fill={pColor} />

      <path d="M42 15 A12 12 0 0 1 58 15" stroke={pColor} strokeWidth="2" />
      <circle cx="42" cy="15" r="2.5" fill={pColor} />
      <circle cx="58" cy="15" r="2.5" fill={pColor} />

      {/* Inner circuits */}
      <path d="M32 30 L42 30 L42 22" stroke={sColor} strokeWidth="2" />
      <path d="M50 22 L50 32" stroke={sColor} strokeWidth="2" />
      <circle cx="50" cy="22" r="2" fill={sColor} />
      <path d="M58 22 L58 32 L68 32" stroke={sColor} strokeWidth="2" />

      {/* Eyes */}
      <circle cx="35" cy="45" r="4" stroke={sColor} strokeWidth="2.5" />
      <path d="M25 45 L31 45" stroke={sColor} strokeWidth="2" />
      <circle cx="25" cy="45" r="2" fill={sColor} />

      <circle cx="65" cy="45" r="4" stroke={sColor} strokeWidth="2.5" />
      <path d="M75 45 L69 45" stroke={sColor} strokeWidth="2" />
      <circle cx="75" cy="45" r="2" fill={sColor} />

      {/* Nose */}
      <path d="M50 38 L50 56 L55 56" stroke={pColor} strokeWidth="2.5" />
      <circle cx="55" cy="56" r="2" fill={pColor} />

      {/* Cheek lines */}
      <path d="M32 56 L24 56" stroke={pColor} strokeWidth="2" />
      <circle cx="24" cy="56" r="2" fill={pColor} />

      <path d="M68 56 L76 56" stroke={pColor} strokeWidth="2" />
      <circle cx="76" cy="56" r="2" fill={pColor} />

      {/* Mouth & chin */}
      <path d="M42 66 L58 66" stroke={sColor} strokeWidth="2.5" />
      <path d="M46 72 L54 72" stroke={sColor} strokeWidth="2" />
      <circle cx="46" cy="72" r="1.5" fill={sColor} />
      <circle cx="54" cy="72" r="1.5" fill={sColor} />

      <path d="M38 82 L50 82 L62 82" stroke={sColor} strokeWidth="2.5" />
      <circle cx="50" cy="82" r="2.5" fill={sColor} />
    </svg>
  );
}
