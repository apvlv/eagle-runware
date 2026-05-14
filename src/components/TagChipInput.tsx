import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

interface TagChipInputProps {
  tags: string[];
  onChange: (next: string[]) => void;
  suggestions?: readonly string[];
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  maxSuggestionsShown?: number;
}

function normalize(tag: string): string {
  return tag.trim();
}

function dedupeAppend(existing: readonly string[], tag: string): string[] | null {
  const t = normalize(tag);
  if (!t) return null;
  const lower = t.toLowerCase();
  if (existing.some((x) => x.toLowerCase() === lower)) return null;
  return [...existing, t];
}

export function TagChipInput({
  tags,
  onChange,
  suggestions = [],
  placeholder = 'Add tag and press Enter',
  disabled = false,
  label,
  maxSuggestionsShown = 6,
}: TagChipInputProps) {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listId = useId();

  const filtered = useMemo(() => {
    if (!input.trim()) return [];
    const lowerInput = input.trim().toLowerCase();
    const taken = new Set(tags.map((t) => t.toLowerCase()));
    return suggestions
      .filter((s) => !taken.has(s.toLowerCase()) && s.toLowerCase().includes(lowerInput))
      .slice(0, maxSuggestionsShown);
  }, [input, suggestions, tags, maxSuggestionsShown]);

  const commit = useCallback(
    (raw: string) => {
      const next = dedupeAppend(tags, raw);
      if (next) onChange(next);
      setInput('');
    },
    [tags, onChange],
  );

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;
      if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
        if (input.trim()) {
          e.preventDefault();
          commit(input);
        }
      } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
        onChange(tags.slice(0, -1));
      }
    },
    [commit, input, tags, onChange, disabled],
  );

  const removeTag = useCallback(
    (tag: string) => {
      onChange(tags.filter((t) => t !== tag));
    },
    [tags, onChange],
  );

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <span className="text-[11px] font-medium uppercase tracking-wide text-fg-muted">
          {label}
        </span>
      )}
      <div
        className={
          'flex flex-wrap items-center gap-1.5 rounded border bg-bg p-1.5 ' +
          (focused ? 'border-focus' : 'border-border')
        }
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded bg-bg-elevated px-1.5 py-0.5 text-xs text-fg"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              disabled={disabled}
              className="text-fg-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={`Remove tag ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (input.trim()) commit(input);
          }}
          placeholder={tags.length === 0 ? placeholder : ''}
          disabled={disabled}
          aria-controls={listId}
          aria-autocomplete="list"
          className="min-w-[6rem] flex-1 bg-transparent px-1 text-sm text-fg placeholder:text-fg-subtle focus:outline-none disabled:cursor-not-allowed"
        />
      </div>
      {focused && filtered.length > 0 && (
        <div
          id={listId}
          role="listbox"
          className="-mt-0.5 flex flex-wrap gap-1 rounded border border-border bg-bg-panel p-1.5 text-xs"
        >
          <span className="self-center text-[10px] uppercase tracking-wide text-fg-subtle">
            Suggest:
          </span>
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              role="option"
              aria-selected={false}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(s);
                inputRef.current?.focus();
              }}
              className="rounded bg-bg-elevated px-1.5 py-0.5 text-xs text-fg hover:bg-accent hover:text-accent-fg"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
