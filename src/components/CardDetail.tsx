import React, { useState } from 'react';
import type { Board, Card, User, Comment as CommentType, FileAttachment, CustomField } from '@/types';
import { Icons } from './Icons';
import FileUpload from './FileUpload';
import DocumentViewer from './DocumentViewer';
import { formatDate, getInitials, generateId } from '@/lib/storage';

interface CardDetailProps {
  card: Card;
  board: Board | undefined;
  users: User[];
  me: User;
  onUpdate: (card: Card, updates: Partial<Card>) => void;
  onDelete: (card: Card) => void;
  onMove: (card: Card, colId: string) => void;
  onClose: () => void;
}

const CardDetail: React.FC<CardDetailProps> = ({ card: initCard, board, users, me, onUpdate, onDelete, onMove, onClose }) => {
  const [card, setCard] = useState(initCard);
  const [editing, setEditing] = useState(false);
  const [assigneeId, setAssigneeId] = useState(card.assigneeId || '');
  const [desc, setDesc] = useState(card.description || '');
  const [newFiles, setNewFiles] = useState<FileAttachment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentFiles, setCommentFiles] = useState<FileAttachment[]>([]);
  const [editCommentId, setEditCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [editCommentFiles, setEditCommentFiles] = useState<FileAttachment[]>([]);
  const [customData, setCD]   = useState<Record<string, string>>({ ...(card.customData || {}) });
  const [clientRef, setClientRef] = useState(card.clientRef || '');
  const [zipping, setZipping] = useState(false);

  const totalFiles = (card.files || []).length + (card.comments || []).reduce((s, c) => s + (c.files?.length || 0), 0);

  const downloadZip = async () => {
    if (zipping) return;
    setZipping(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      const cardFiles = card.files || [];
      if (cardFiles.length > 0) {
        const folder = zip.folder('Archivos del caso')!;
        cardFiles.forEach((f, i) => {
          folder.file(`${i + 1}_${f.name}`, f.data.split(',')[1], { base64: true });
        });
      }

      const commentFilesAll = (card.comments || []).flatMap(c => c.files || []);
      if (commentFilesAll.length > 0) {
        const folder = zip.folder('Archivos de comentarios')!;
        commentFilesAll.forEach((f, i) => {
          folder.file(`${i + 1}_${f.name}`, f.data.split(',')[1], { base64: true });
        });
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${card.code}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setZipping(false);
    }
  };

  const col = board?.columns.find(c => c.id === card.columnId);
  const assignee = users.find(u => u.id === card.assigneeId);
  const assignable = users.filter(u => u.active && (u.isAdminTotal || u.boardRoles[board?.id || '']));
  const role = me.isAdminTotal ? 'admin_total' : me.boardRoles[board?.id || ''];
  const canEdit = role === 'admin_total' || role === 'admin_tablero' || role === 'ejecutor';
  const canDel = role === 'admin_total' || role === 'admin_tablero';
  const canMove = canEdit;
  const sortedCols = [...(board?.columns || [])].sort((a, b) => a.order - b.order);
  const lastCol = sortedCols[sortedCols.length - 1];

  const canEditComment = (c: CommentType) => c.authorId === me.id || me.isAdminTotal || me.boardRoles[board?.id || ''] === 'admin_tablero';

  const saveEdit = () => {
    const allFiles = [...(card.files || []), ...newFiles];
    const upd: Partial<Card> = { assigneeId, description: desc, files: allFiles, customData, clientRef: clientRef || undefined };
    if (assigneeId !== card.assigneeId) {
      const a = users.find(u => u.id === assigneeId);
      upd.assigneeHistory = [...(card.assigneeHistory || []), { id: generateId(), assigneeId, assigneeName: a?.fullName || 'Desconocido', assignedAt: new Date().toISOString() }];
    }
    onUpdate(card, upd);
    setCard(c => ({ ...c, ...upd, modifiedBy: me.fullName, modifiedAt: new Date().toISOString() }));
    setEditing(false);
    setNewFiles([]);
  };

  const addComment = () => {
    if (!commentText.trim() && commentFiles.length === 0) return;
    const cmt: CommentType = { id: generateId(), authorId: me.id, authorName: me.fullName, text: commentText.trim(), files: commentFiles, createdAt: new Date().toISOString(), modifiedBy: null, modifiedAt: null };
    const newComments = [...(card.comments || []), cmt];
    onUpdate(card, { comments: newComments });
    setCard(c => ({ ...c, comments: newComments, modifiedBy: me.fullName, modifiedAt: new Date().toISOString() }));
    setCommentText('');
    setCommentFiles([]);
  };

  const saveEditComment = () => {
    const nc = (card.comments || []).map(c => c.id === editCommentId ? { ...c, text: editCommentText.trim(), files: editCommentFiles, modifiedBy: me.fullName, modifiedAt: new Date().toISOString() } : c);
    onUpdate(card, { comments: nc });
    setCard(c => ({ ...c, comments: nc }));
    setEditCommentId(null);
  };

  const deleteComment = (id: string) => {
    const nc = (card.comments || []).filter(c => c.id !== id);
    onUpdate(card, { comments: nc });
    setCard(c => ({ ...c, comments: nc }));
  };

  const handleMove = (colId: string) => { onMove(card, colId); setCard(c => ({ ...c, columnId: colId })); };

  const isFormulaField = (cf: CustomField) =>
    cf.formula === 'createdAt' && cf.formulaDays !== undefined && board?.landing?.enabled;

  const renderCFField = (cf: CustomField) => {
    const val = customData[cf.id] || '';
    const onChange = (v: string) => setCD(p => ({ ...p, [cf.id]: v }));
    // Formula fields are always read-only
    if (!editing || isFormulaField(cf)) {
      return (
        <div className="flex items-center gap-2">
          <div className="text-[13px]" style={{ color: val ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))' }}>{val || '—'}</div>
          {isFormulaField(cf) && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary"><Icons.formula size={9} /> Auto</span>}
        </div>
      );
    }
    switch (cf.type) {
      case 'dropdown': return <select className="w-full py-2 px-3 bg-surface-2 border border-border rounded-lg text-foreground text-[13px] outline-none cursor-pointer" value={val} onChange={e => onChange(e.target.value)}><option value="">—</option>{cf.options.map(o => <option key={o} value={o}>{o}</option>)}</select>;
      case 'date': return <input className="w-full py-2 px-3 bg-surface-2 border border-border rounded-lg text-foreground text-[13px] outline-none" type="date" value={val} onChange={e => onChange(e.target.value)} />;
      case 'number': return <input className="w-full py-2 px-3 bg-surface-2 border border-border rounded-lg text-foreground text-[13px] outline-none" type="number" value={val} onChange={e => onChange(e.target.value)} />;
      default: return <input className="w-full py-2 px-3 bg-surface-2 border border-border rounded-lg text-foreground text-[13px] outline-none" value={val} onChange={e => onChange(e.target.value)} />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-[4px]" onClick={onClose}>
      <div className="bg-card border border-border rounded-[14px] w-[750px] max-h-[85vh] overflow-y-auto p-7 fade-in" onClick={e => e.stopPropagation()}>
        {card.deleted && <div className="p-2.5 px-3.5 rounded-lg text-[13px] font-semibold mb-4 bg-destructive/10 text-destructive">⚠ Eliminado de la vista</div>}
        {card.closed && <div className="p-2.5 px-3.5 rounded-lg text-[13px] font-semibold mb-4 bg-success/10 text-success flex items-center gap-1.5"><Icons.lock size={14} /> Caso cerrado el {formatDate(card.closedAt)} por {card.closedBy}</div>}

        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-[13px] text-primary font-bold mb-1">{card.code}</div>
            <div className="text-[17px] font-bold text-foreground">{card.title}</div>
          </div>
          <div className="flex gap-1.5">
            {canEdit && !card.deleted && !card.closed && !editing && <button className="flex items-center gap-1 px-3 py-[7px] bg-surface-3 text-foreground border border-border rounded-md text-[12px] font-semibold cursor-pointer hover:bg-surface-4" onClick={() => setEditing(true)}><Icons.edit size={12} /> Editar</button>}
            {canDel && !card.deleted && !card.closed && <button className="flex items-center gap-1 px-3 py-[7px] bg-destructive/10 text-destructive rounded-md text-[12px] font-semibold cursor-pointer hover:bg-destructive/20" onClick={() => onDelete(card)}><Icons.trash size={12} /> Eliminar</button>}
          </div>
        </div>

        <div className="grid grid-cols-[1fr_260px] gap-5">
          {/* Main */}
          <div className="min-w-0">
            {/* Description */}
            <div className="py-3.5 border-b border-border">
              <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">Descripción</div>
              {editing ? <textarea className="w-full py-2 px-3 bg-surface-2 border border-border rounded-lg text-foreground text-[13px] outline-none min-h-[80px] resize-y mt-1.5" value={desc} onChange={e => setDesc(e.target.value)} />
                : <div className={`text-[13px] whitespace-pre-wrap leading-relaxed ${!card.description ? 'text-text-muted italic' : 'text-foreground'}`}>{card.description || 'Sin descripción'}</div>}
            </div>

            {/* Custom Fields */}
            {(board?.customFields || []).length > 0 && (
              <div className="py-3.5 border-b border-border">
                <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">Campos Personalizados</div>
                {(board!.customFields || []).map(cf => (
                  <div key={cf.id} className="mb-2">
                    {editing ? (
                      <div><label className="block text-[11px] font-semibold text-text-secondary mb-1 uppercase tracking-wide">{cf.name}</label>{renderCFField(cf)}</div>
                    ) : (
                      <div><div className="text-[11px] text-text-muted font-semibold">{cf.name}</div>{renderCFField(cf)}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Files */}
            <div className="py-3.5 border-b border-border">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">Archivos ({(card.files || []).length})</div>
                {totalFiles >= 2 && (
                  <button
                    className="flex items-center gap-1 px-2.5 py-1 bg-surface-3 border border-border rounded text-[11px] font-semibold text-foreground cursor-pointer hover:bg-surface-4 disabled:opacity-50"
                    onClick={downloadZip}
                    disabled={zipping}
                  >
                    <Icons.dl size={11} />
                    {zipping ? 'Generando...' : `Descargar todo (${totalFiles}) como ZIP`}
                  </button>
                )}
              </div>
              <FileUpload files={card.files || []} onAdd={editing ? f => setNewFiles(p => [...p, f]) : undefined} onRemove={editing ? fid => { const uf = (card.files || []).filter(f => f.id !== fid); onUpdate(card, { files: uf }); setCard(c => ({ ...c, files: uf })); } : undefined} disabled={!editing} />
              {editing && newFiles.length > 0 && <><div className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mt-2.5 mb-1">Nuevos</div><FileUpload files={newFiles} onRemove={id => setNewFiles(p => p.filter(x => x.id !== id))} /></>}
            </div>

            {editing && (
              <div className="flex gap-2 mt-3">
                <button className="px-3 py-[7px] bg-surface-3 text-foreground border border-border rounded-md text-[12px] font-semibold cursor-pointer hover:bg-surface-4"
                  onClick={() => { setEditing(false); setAssigneeId(card.assigneeId || ''); setDesc(card.description || ''); setNewFiles([]); setCD({ ...(card.customData || {}) }); }}>Cancelar</button>
                <button className="px-3 py-[7px] bg-success text-success-foreground rounded-md text-[12px] font-semibold cursor-pointer hover:brightness-110" onClick={saveEdit}>Guardar</button>
              </div>
            )}

            {/* Move */}
            {canMove && !card.deleted && !card.closed && (
              <div className="py-3.5 border-b border-border">
                <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">Mover a</div>
                <div className="flex gap-1.5 flex-wrap mt-2.5">
                  {sortedCols.filter(c => c.id !== card.columnId).map(c => {
                    const isLast = c.id === lastCol?.id;
                    return <button key={c.id} className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${isLast ? 'bg-success text-success-foreground hover:brightness-110' : 'bg-surface-3 text-foreground border border-border hover:bg-surface-4'}`}
                      onClick={() => handleMove(c.id)}>{isLast && <Icons.check size={10} />}{c.name}</button>;
                  })}
                </div>
              </div>
            )}

            {/* Documentos sincronizados SFTP */}
            {card.clientRef && (
              <div className="py-3.5 border-b border-border">
                <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-2">
                  Documentos — {card.clientRef}
                </div>
                <DocumentViewer cardId={card.id} />
              </div>
            )}

            {/* Comments */}
            <div className="py-3.5">
              <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">Comentarios ({(card.comments || []).length})</div>
              <div className="flex flex-col gap-3 mt-2">
                {(card.comments || []).map(cmt => (
                  <div key={cmt.id} className="bg-surface-2 border border-border rounded-lg p-3.5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-full bg-success/10 text-success flex items-center justify-center text-[10px] font-bold shrink-0">{getInitials(cmt.authorName)}</div>
                      <div>
                        <div className="text-[13px] font-semibold text-foreground">{cmt.authorName}</div>
                        <div className="text-[11px] text-text-muted">{formatDate(cmt.createdAt)}</div>
                      </div>
                      {editCommentId !== cmt.id && canEditComment(cmt) && (
                        <div className="flex gap-1 ml-auto">
                          <button className="px-2 py-1 bg-surface-3 text-foreground border border-border rounded text-[11px] cursor-pointer hover:bg-surface-4"
                            onClick={() => { setEditCommentId(cmt.id); setEditCommentText(cmt.text); setEditCommentFiles([...(cmt.files || [])]); }}><Icons.edit size={10} /></button>
                          <button className="px-2 py-1 bg-destructive/10 text-destructive rounded text-[11px] cursor-pointer hover:bg-destructive/20"
                            onClick={() => deleteComment(cmt.id)}><Icons.trash size={10} /></button>
                        </div>
                      )}
                    </div>
                    {editCommentId === cmt.id ? (
                      <div>
                        <textarea className="w-full py-2 px-3 bg-surface-2 border border-border rounded-lg text-foreground text-[13px] outline-none min-h-[60px]" value={editCommentText} onChange={e => setEditCommentText(e.target.value)} />
                        <div className="mt-2"><FileUpload files={editCommentFiles} onAdd={f => setEditCommentFiles(p => [...p, f])} onRemove={id => setEditCommentFiles(p => p.filter(x => x.id !== id))} /></div>
                        <div className="flex gap-1.5 mt-2">
                          <button className="px-2.5 py-1 bg-surface-3 text-foreground border border-border rounded text-[11px] cursor-pointer" onClick={() => setEditCommentId(null)}>Cancelar</button>
                          <button className="px-2.5 py-1 bg-success text-success-foreground rounded text-[11px] cursor-pointer" onClick={saveEditComment}>Guardar</button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {cmt.text && <div className="text-[13px] text-text-secondary whitespace-pre-wrap leading-relaxed">{cmt.text}</div>}
                        {cmt.files?.length > 0 && <div className="mt-2"><FileUpload files={cmt.files} disabled /></div>}
                        {cmt.modifiedBy && <div className="text-[10px] text-text-muted mt-1.5 italic">Editado por {cmt.modifiedBy} — {formatDate(cmt.modifiedAt)}</div>}
                      </div>
                    )}
                  </div>
                ))}
                {!(card.comments || []).length && <div className="text-[12px] text-text-muted italic p-2">Sin comentarios</div>}
              </div>
              {canEdit && !card.deleted && !card.closed && (
                <div className="bg-surface-2 border border-border rounded-lg p-3.5 mt-3">
                  <textarea className="w-full py-2 px-3 bg-surface-2 border border-border rounded-lg text-foreground text-[13px] outline-none min-h-[60px] mb-2" placeholder="Comentario..." value={commentText} onChange={e => setCommentText(e.target.value)} />
                  <FileUpload files={commentFiles} onAdd={f => setCommentFiles(p => [...p, f])} onRemove={id => setCommentFiles(p => p.filter(x => x.id !== id))} />
                  <div className="mt-2 flex justify-end">
                    <button className="flex items-center gap-1 px-3 py-[7px] bg-primary text-primary-foreground rounded-md text-[12px] font-semibold cursor-pointer hover:brightness-110 disabled:opacity-50"
                      onClick={addComment} disabled={!commentText.trim() && !commentFiles.length}><Icons.msg size={12} /> Comentar</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="bg-surface-2 rounded-lg p-4 border border-border self-start">
            <div><div className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">Estado</div><span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${card.closed ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>{card.closed ? 'Cerrado' : col?.name || '—'}</span></div>
            <div className="mt-3"><div className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">Tablero</div><div className="text-[13px] text-foreground">{board?.name}</div></div>
            <div className="mt-3">
              <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">Responsable</div>
              {editing ? <select className="w-full py-2 px-3 bg-surface-2 border border-border rounded-lg text-foreground text-[13px] outline-none cursor-pointer mt-1" value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>{assignable.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}</select>
                : <div className="text-[13px] text-foreground">{assignee?.fullName || <span className="text-text-muted italic">Sin asignar</span>}</div>}
            </div>
            <div className="border-t border-border pt-3 mt-3"><div className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">Informador</div><div className="text-[13px] text-foreground">{card.reporterName}</div></div>
            <div className="mt-2"><div className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">Creado</div><div className="text-[12px] text-foreground">{formatDate(card.createdAt)}</div></div>
            {card.modifiedBy && <div className="border-t border-border pt-3 mt-3"><div className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">Modificado</div><div className="text-[13px] text-foreground">{card.modifiedBy}<br /><span className="text-[11px] text-text-muted">{formatDate(card.modifiedAt)}</span></div></div>}
            {card.closed && <div className="border-t border-border pt-3 mt-3"><div className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">Cerrado</div><div className="text-[13px] text-foreground">{card.closedBy}<br /><span className="text-[11px] text-text-muted">{formatDate(card.closedAt)}</span></div></div>}
            <div className="border-t border-border pt-3 mt-3">
              <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">Ref. Cliente</div>
              {editing
                ? <input
                    className="w-full py-1.5 px-2.5 bg-surface-2 border border-border rounded-lg text-foreground text-[12px] outline-none focus:border-primary mt-1 font-mono"
                    value={clientRef}
                    onChange={e => setClientRef(e.target.value.toUpperCase())}
                    placeholder="Ej: CN13718"
                  />
                : <div className="text-[13px] font-mono text-foreground">{card.clientRef || <span className="text-text-muted italic text-[12px]">Sin referencia</span>}</div>
              }
            </div>
            <div className="border-t border-border pt-3 mt-3">
              <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">Historial de Responsables</div>
              <div className="mt-1.5 text-[11px] text-text-secondary leading-snug">
                {(card.assigneeHistory || []).map(h => <div key={h.id} className="mb-1">asignado: {h.assigneeName} a las {formatDate(h.assignedAt)}</div>)}
                {!card.assigneeHistory?.length && <div className="text-text-muted italic">Sin historial previo.</div>}
              </div>
            </div>
            <div className="border-t border-border pt-3 mt-3">
              <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">Historial de Movimientos</div>
              <div className="mt-1.5 text-[11px] text-text-secondary leading-snug">
                {(card.moveHistory || []).map(h => <div key={h.id} className="mb-1">de {h.fromCol} a {h.toCol} a las {formatDate(h.movedAt)}</div>)}
                {!card.moveHistory?.length && <div className="text-text-muted italic">Sin movimientos previos.</div>}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button className="px-5 py-2.5 bg-surface-3 text-foreground border border-border rounded-lg text-[13px] font-semibold cursor-pointer hover:bg-surface-4" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
};

export default CardDetail;
