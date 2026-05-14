import { useState } from 'react';

interface StarRatingProps {
  value: number;
  onChange?: (next: number) => void;
  disabled?: boolean;
  size?: number;
  label?: string;
  className?: string;
}

export function StarRating({
  value,
  onChange,
  disabled = false,
  size = 14,
  label = 'Rating',
  className = '',
}: StarRatingProps) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value;

  const handleClick = (n: number) => {
    if (disabled || !onChange) return;
    onChange(value === n ? 0 : n);
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-flex items-center gap-0.5 ${className}`}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= display;
        const accent = hover != null;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === value}
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
            disabled={disabled}
            onMouseEnter={() => !disabled && setHover(n)}
            onMouseLeave={() => !disabled && setHover(null)}
            onFocus={() => !disabled && setHover(n)}
            onBlur={() => !disabled && setHover(null)}
            onClick={() => handleClick(n)}
            className={
              'flex flex-none items-center justify-center rounded-sm transition-colors ' +
              (disabled
                ? 'cursor-not-allowed opacity-60'
                : 'cursor-pointer hover:bg-bg-elevated/40')
            }
            style={{ width: size + 4, height: size + 4 }}
          >
            <svg
              viewBox="0 0 20 20"
              width={size}
              height={size}
              aria-hidden="true"
              className={
                filled
                  ? accent
                    ? 'text-warn'
                    : 'text-warn'
                  : 'text-fg-subtle'
              }
            >
              <path
                d="M10 1.5l2.65 5.37 5.93.86-4.29 4.18 1.01 5.9L10 15.02l-5.3 2.79 1.01-5.9L1.42 7.73l5.93-.86L10 1.5z"
                fill={filled ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
