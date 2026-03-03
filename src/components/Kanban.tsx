import React, { useState, useMemo, useCallback, memo } from 'react';
import type { Board, Card, User } from '@/types';
import { Icons } from './Icons';
import { getInitials } from '@/lib/storage';

interface KanbanProps {
  board: Board;
  cards: Card[];
  users: User[];
  me: User;
  onColumns: (b: Board) => void;
  onCreate: (b: Board) => void;
  onCardClick: (c: Card) => void;
  onMoveCard: (cardId: string, colId: string) => void;
  onCloseCase: (data: { card: Card; colId: string }) => void;
  /** Llamado cuando el usuario pulsa "Importar desde SP". Solo se pasa si el SP está habilitado. */
  onSpImport?: (b: Board) => void;
  /** true mientras el import del SP está en progreso */
  isSpImporting?: boolean;
}

// ── KanbanCard: memoizado para evitar re-render de TODAS las tarjetas al mover una ──
interface KanbanCardProps {
  card: Card;
  users: User[];
  isDragging: boolean;
  canMove: boolean;
  isLastCol: boolean;
  onCardClick: (c: Card) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onCloseCase: (card: Card) => void;
}

const KanbanCard = memo(({ card: c, users, isDragging, canMove, isLastCol, onCardClick, onDragStart, onDragEnd, onCloseCase }: KanbanCardProps) => (
  <div
    className={`bg-surface-2 border border-border rounded-lg p-3 mb-2 cursor-pointer transition-all select-none hover:border-primary ${isDragging ? 'opacity-50 border-primary' : ''}`}
    draggable={canMove}
    onDragStart={e => { if (!canMove) return; onDragStart(c.id); e.dataTransfer.effectAllowed = 'move'; }}
    onDragEnd={onDragEnd}
    onClick={() => onCardClick(c)}>
    <div className="flex items-center gap-1.5 mb-1">
      <span className="text-[12px] text-primary font-semibold">{c.code}</span>
      {c.spExternalId && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20">SP</span>}
    </div>
    <div className="text-[15px] text-foreground font-medium leading-[1.4] mb-2 line-clamp-2">{c.title}</div>
    <div className="flex items-center gap-1.5 flex-wrap">
      {c.priority && (
        <span className={`text-[11px] font-bold py-0.5 px-1.5 rounded ${c.priority === 'alta' ? 'bg-destructive/10 text-destructive' : c.priority === 'media' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
          {c.priority.charAt(0).toUpperCase() + c.priority.slice(1)}
        </span>
      )}
      {c.type && <span className="text-[11px] text-text-muted bg-surface-3 py-0.5 px-1.5 rounded">{c.type}</span>}
      <span className="ml-auto text-[10px] text-text-muted flex items-center gap-1">
        <Icons.msg size={10} />{(c.comments || []).length > 0 && <span>{c.comments.length}</span>}
        {(c.files || []).length > 0 && <span className="ml-0.5 flex items-center gap-0.5"><Icons.clip size={10} />{c.files.length}</span>}
      </span>
      {c.assigneeId && (
        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-bold">
          {getInitials(users.find(u => u.id === c.assigneeId)?.fullName || '')}
        </span>
      )}
    </div>
    {isLastCol && canMove && (
      <button
        className="w-full mt-2.5 py-1 px-2.5 bg-success text-success-foreground rounded text-[12px] font-semibold cursor-pointer flex items-center justify-center gap-1 hover:brightness-110"
        onClick={e => { e.stopPropagation(); onCloseCase(c); }}>
        <Icons.check size={10} /> Cerrar Caso
      </button>
    )}
  </div>
));
KanbanCard.displayName = 'KanbanCard';

const Kanban: React.FC<KanbanProps> = ({ board, cards, users, me, onColumns, onCreate, onCardClick, onMoveCard, onCloseCase, onSpImport, isSpImporting }) => {
  const sortedCols = [...board.columns].sort((a, b) => a.order - b.order);
  const lastCol = sortedCols[sortedCols.length - 1];
  const [filterAssigned, setFA] = useState(false);
  const [filterReported, setFR] = useState(false);

  const boardCards = useMemo(() => cards.filter(c => {
    if (c.boardId !== board.id || c.deleted || c.closed) return false;
    if (filterAssigned && c.assigneeId !== me.id) return false;
    if (filterReported && c.reporterId !== me.id) return false;
    return true;
  }), [cards, board.id, me.id, filterAssigned, filterReported]);

  const role = me.isAdminTotal ? 'admin_total' : me.boardRoles[board.id];
  const canCreate = role !== 'consulta';
  const canMove = role === 'admin_total' || role === 'admin_tablero' || role === 'ejecutor';
  const canEditCols = me.isAdminTotal || me.boardRoles[board.id] === 'admin_tablero';

  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  // useCallback: handlers estables para que KanbanCard no re-renderice por referencia nueva
  const handleDragStart = useCallback((id: string) => setDragId(id), []);
  const handleDragEnd   = useCallback(() => setDragId(null), []);
  const handleCloseCase = useCallback((card: Card) => onCloseCase({ card, colId: card.columnId }), [onCloseCase]);

  if (!sortedCols.length) {
    return (
      <div className="fade-in text-center py-16">
        <div className="text-[40px] opacity-30">📋</div>
        <h3 className="text-[15px] text-text-secondary mt-3">Sin carriles</h3>
        {canEditCols && <button className="mt-4 flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-[12px] font-semibold cursor-pointer mx-auto" onClick={() => onColumns(board)}><Icons.columns size={14} /> Configurar</button>}
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="mb-3.5 flex items-center gap-3 flex-wrap">
        {canCreate && <button className="flex items-center gap-1.5 px-3 py-[7px] bg-success text-success-foreground rounded-md text-[12px] font-semibold cursor-pointer hover:brightness-110" onClick={() => onCreate(board)}><Icons.plus size={14} /> Crear Caso</button>}
        {onSpImport && board.spAutoImport?.enabled && (
          <button
            className={`flex items-center gap-1.5 px-3 py-[7px] rounded-md text-[12px] font-semibold cursor-pointer border transition-colors
              ${isSpImporting
                ? 'bg-warning/10 text-warning border-warning/30 cursor-not-allowed opacity-70'
                : 'bg-warning/10 text-warning border-warning/30 hover:bg-warning/20'}`}
            onClick={() => !isSpImporting && onSpImport(board)}
            disabled={isSpImporting}
            title={isSpImporting ? 'Importando...' : 'Importar casos desde SP'}>
            {isSpImporting
              ? <><Icons.spinner size={13} className="animate-spin" /> Importando...</>
              : <><Icons.sync size={13} /> Importar SP</>}
          </button>
        )}
        <div className="flex gap-1.5">
          <button className={`px-2.5 py-1 rounded text-[12px] font-semibold cursor-pointer transition-colors ${filterAssigned ? 'bg-primary text-primary-foreground' : 'bg-surface-3 text-foreground border border-border hover:bg-surface-4'}`}
            onClick={() => setFA(!filterAssigned)}>Asignados a mi</button>
          <button className={`px-2.5 py-1 rounded text-[12px] font-semibold cursor-pointer transition-colors ${filterReported ? 'bg-primary text-primary-foreground' : 'bg-surface-3 text-foreground border border-border hover:bg-surface-4'}`}
            onClick={() => setFR(!filterReported)}>Creados por mi</button>
        </div>
        <div className="flex-1" />
        <span className="text-[12px] text-text-muted">{boardCards.length} abiertos</span>
        {canEditCols && <button className="flex items-center gap-1.5 px-3 py-[7px] bg-surface-3 text-foreground border border-border rounded-md text-[12px] font-semibold cursor-pointer hover:bg-surface-4" onClick={() => onColumns(board)}><Icons.columns size={14} /> Carriles</button>}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 200px)' }}>
        {sortedCols.map(col => {
          const colCards = boardCards.filter(c => c.columnId === col.id);
          const isLast = col.id === lastCol?.id;
          return (
            <div key={col.id}
              className={`min-w-[240px] max-w-[280px] flex-[0_0_240px] bg-card border rounded-[10px] flex flex-col transition-colors ${overCol === col.id ? 'border-primary shadow-[0_0_0_2px_hsl(var(--primary)/0.1)]' : isLast ? 'border-success' : 'border-border'}`}
              style={{ maxHeight: 'calc(100vh - 200px)' }}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOverCol(col.id); }}
              onDragLeave={() => setOverCol(null)}
              onDrop={e => { e.preventDefault(); setOverCol(null); if (dragId) { onMoveCard(dragId, col.id); setDragId(null); } }}>
              <div className="py-3 px-3.5 border-b border-border flex items-center justify-between shrink-0">
                <span className="text-[12px] font-bold text-foreground uppercase tracking-tight">
                  {col.name}
                  {isLast && <span className="ml-1.5 text-[11px] text-success">✓ CIERRE</span>}
                </span>
                <span className="text-[11px] text-text-muted bg-surface-3 px-2 py-0.5 rounded-[10px] font-semibold">{colCards.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-2 min-h-[60px]">
                {colCards.map(c => (
                  <KanbanCard
                    key={c.id}
                    card={c}
                    users={users}
                    isDragging={dragId === c.id}
                    canMove={canMove}
                    isLastCol={isLast}
                    onCardClick={onCardClick}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onCloseCase={handleCloseCase}
                  />
                ))}
                {!colCards.length && <div className="py-6 px-3 text-center text-[12px] text-text-muted italic">Sin casos</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Kanban;
