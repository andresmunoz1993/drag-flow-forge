import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { User } from '@/types';
import { getInitials } from '@/lib/storage';

interface MentionTextareaProps {
  value: string;
  onChange: (v: string) => void;
  users: User[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minRows?: number;
}

/**
 * Textarea con soporte de @menciones.
 * Al escribir '@', muestra un dropdown con los usuarios del tablero filtrado por lo que se sigue escribiendo.
 * Seleccionar un usuario inserta '@NombreCompleto ' en el texto.
 */
const MentionTextarea: React.FC<MentionTextareaProps> = ({
  value,
  onChange,
  users,
  placeholder = '',
  disabled = false,
  className = '',
  minRows = 3,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Posición del '@' en el texto que inicia la mención activa
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const showDropdown = mentionStart !== null;

  // Filtrar usuarios por query
  const filtered = users.filter(u =>
    !query || u.fullName.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8); // max 8 usuarios en dropdown

  // Insertar mención en el texto
  const insertMention = useCallback((user: User) => {
    if (mentionStart === null || !textareaRef.current) return;
    const cursorPos = textareaRef.current.selectionStart;
    const before = value.slice(0, mentionStart);
    const after  = value.slice(cursorPos);
    const inserted = `@${user.fullName} `;
    onChange(before + inserted + after);
    setMentionStart(null);
    setQuery('');
    // Restaurar foco y posición del cursor
    const newPos = mentionStart + inserted.length;
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(newPos, newPos);
    });
  }, [mentionStart, value, onChange]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange(val);
    const cursor = e.target.selectionStart;

    if (mentionStart !== null) {
      // El '@' puede haber sido borrado
      if (val[mentionStart] !== '@') {
        setMentionStart(null);
        setQuery('');
      } else {
        const q = val.slice(mentionStart + 1, cursor);
        // Si hay salto de línea o doble espacio, cancelar
        if (q.includes('\n')) {
          setMentionStart(null);
          setQuery('');
        } else {
          setQuery(q);
          setActiveIndex(0);
        }
      }
    } else {
      // Detectar nuevo '@'
      const lastChar = val[cursor - 1];
      if (lastChar === '@') {
        setMentionStart(cursor - 1);
        setQuery('');
        setActiveIndex(0);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showDropdown || !filtered.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (showDropdown && filtered[activeIndex]) {
        e.preventDefault();
        insertMention(filtered[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setMentionStart(null);
      setQuery('');
    }
  };

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current && !textareaRef.current.contains(e.target as Node)
      ) {
        setMentionStart(null);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const baseClass = `w-full py-2 px-3 bg-surface-2 border border-border rounded-lg text-foreground text-[13px] outline-none focus:border-primary resize-y placeholder:text-text-muted ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`;

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        className={`${baseClass} ${className}`}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={minRows}
      />

      {/* Dropdown de menciones */}
      {showDropdown && filtered.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 left-0 right-0 bg-card border border-border rounded-lg shadow-lg overflow-hidden mt-0.5"
          style={{ maxHeight: '200px', overflowY: 'auto' }}
        >
          <div className="px-2.5 py-1.5 border-b border-border text-[10px] font-semibold text-text-muted uppercase tracking-wide">
            Etiquetar colaborador
          </div>
          {filtered.map((u, i) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); insertMention(u); }}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer transition-colors ${
                i === activeIndex ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-surface-3'
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                i === activeIndex ? 'bg-primary text-primary-foreground' : 'bg-surface-3 text-text-secondary'
              }`}>
                {getInitials(u.fullName)}
              </div>
              <span className="font-medium">{u.fullName}</span>
              <span className="text-text-muted text-[11px] ml-auto">@{u.username}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-[12px] text-text-muted">Sin resultados</div>
          )}
        </div>
      )}
    </div>
  );
};

export default MentionTextarea;

/**
 * Renderiza texto con @NombreCompleto resaltado como chips visuales.
 * Útil para la vista de solo lectura de descripciones y comentarios.
 */
export function renderWithMentions(text: string, users: User[]): React.ReactNode {
  if (!text) return null;
  if (!users.length) return <>{text}</>;

  // Ordenar por longitud descendente para evitar solapamientos de nombres cortos
  const names = [...users.map(u => u.fullName)]
    .sort((a, b) => b.length - a.length)
    .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (!names.length) return <>{text}</>;

  const pattern = new RegExp(`@(${names.join('|')})`, 'gi');
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <span
        key={match.index}
        className="inline-flex items-center px-1.5 py-0.5 rounded text-[12px] font-semibold bg-primary/10 text-primary"
      >
        @{match[1]}
      </span>
    );
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return <>{parts}</>;
}
