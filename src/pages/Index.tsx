import React, { useState, useEffect } from 'react';
import type { User, Board, Card, Column, CustomField } from '@/types';
import { ROLE_LABELS } from '@/types';
import { loadData, saveData, generateId, getInitials } from '@/lib/storage';
import { defaultUsers, defaultBoards, defaultCards } from '@/lib/storage';
import { Icons } from '@/components/Icons';

import Login from '@/components/Login';
import Dashboard from '@/components/Dashboard';
import UserList from '@/components/UserList';
import UserForm from '@/components/UserForm';
import BoardManagement, { BoardForm, ColumnManager, CustomFieldManager } from '@/components/BoardManagement';
import Kanban from '@/components/Kanban';
import CreateCard from '@/components/CreateCard';
import CardDetail from '@/components/CardDetail';
import CaseList from '@/components/CaseList';
import CustomFieldList, { FieldForm } from '@/components/CustomFieldList';
import Confirm from '@/components/Confirm';

const Index = () => {
  const [users, setUsers] = useState<User[]>(() => loadData('users', defaultUsers));
  const [boards, setBoards] = useState<Board[]>(() => loadData('boards', defaultBoards));
  const [cards, setCards] = useState<Card[]>(() => loadData('cards', defaultCards));
  const [nextGlobalNum, setNextGlobalNum] = useState<number>(() => {
    const s = loadData<number | null>('nextGlobalNum', () => null);
    if (s !== null) return s;
    const nums = cards.map(c => parseInt(c.code.split('-')[1])).filter(n => !isNaN(n));
    return Math.max(101, ...nums) === -Infinity ? 101 : Math.max(101, ...nums) + 1;
  });

  const [me, setMe] = useState<User | null>(null);
  const [page, setPage] = useState('dashboard');

  // Modal states
  const [editUser, setEditUser] = useState<User | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [editBoard, setEditBoard] = useState<Board | null>(null);
  const [manageCols, setManageCols] = useState<Board | null>(null);
  const [manageCF, setManageCF] = useState<Board | null>(null);
  const [createCardBoard, setCreateCardBoard] = useState<Board | null>(null);
  const [viewCard, setViewCard] = useState<Card | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<User | null>(null);
  const [confirmDeleteBoard, setConfirmDeleteBoard] = useState<Board | null>(null);
  const [confirmDeleteCard, setConfirmDeleteCard] = useState<Card | null>(null);
  const [closeConfirm, setCloseConfirm] = useState<{ card: Card; colId: string } | null>(null);
  const [feedback, setFeedback] = useState<{ type: string; message: string } | null>(null);
  const [showFieldForm, setShowFieldForm] = useState(false);
  const [editField, setEditField] = useState<(CustomField & { boardId?: string }) | null>(null);
  const [confirmDeleteField, setConfirmDeleteField] = useState<(CustomField & { boardId: string; boardName: string }) | null>(null);

  // Persist
  useEffect(() => { saveData('users', users); }, [users]);
  useEffect(() => { saveData('boards', boards); }, [boards]);
  useEffect(() => { saveData('cards', cards); }, [cards]);
  useEffect(() => { saveData('nextGlobalNum', nextGlobalNum); }, [nextGlobalNum]);
  useEffect(() => { if (feedback) { const t = setTimeout(() => setFeedback(null), 3000); return () => clearTimeout(t); } }, [feedback]);

  const fb = (m: string) => setFeedback({ type: 'ok', message: m });

  // Auth
  const login = (u: User) => { setMe(u); setPage('dashboard'); };
  const logout = () => setMe(null);

  if (!me) return <Login onLogin={login} users={users} />;

  const isAdmin = me.isAdminTotal;
  const visibleBoards = isAdmin ? boards : boards.filter(b => me.boardRoles[b.id]);
  const visibleCards = isAdmin ? cards : cards.filter(c => me.boardRoles[c.boardId]);

  // User CRUD
  const saveUser = (form: Partial<User>) => {
    if (editUser) {
      setUsers(p => p.map(u => {
        if (u.id !== editUser.id) return u;
        const up = { ...u, ...form } as User;
        if (!form.password) up.password = u.password;
        if (form.isAdminTotal) up.boardRoles = {};
        return up;
      }));
      if (editUser.id === me.id) setMe(p => p ? { ...p, ...form, password: form.password || p.password } as User : null);
      fb('Actualizado');
      setEditUser(null);
    } else {
      const nu: User = { id: generateId(), ...(form as User), createdAt: new Date().toISOString() };
      if (nu.isAdminTotal) nu.boardRoles = {};
      setUsers(p => [...p, nu]);
      fb('Creado');
      setShowCreateUser(false);
    }
  };

  const deleteUser = () => {
    if (!confirmDeleteUser) return;
    setUsers(p => p.filter(u => u.id !== confirmDeleteUser.id));
    fb('Eliminado');
    setConfirmDeleteUser(null);
  };

  // Board CRUD
  const saveBoard = (data: { name: string; prefix: string }) => {
    if (editBoard) {
      setBoards(p => p.map(b => b.id === editBoard.id ? { ...b, ...data } : b));
      fb('Actualizado');
      setEditBoard(null);
    } else {
      setBoards(p => [...p, { id: generateId(), ...data, nextNum: 1, columns: [], customFields: [] }]);
      fb('Creado');
      setShowCreateBoard(false);
    }
  };

  const deleteBoard = () => {
    if (!confirmDeleteBoard) return;
    const id = confirmDeleteBoard.id;
    setBoards(p => p.filter(b => b.id !== id));
    setCards(p => p.filter(c => c.boardId !== id));
    setUsers(p => p.map(u => { const br = { ...u.boardRoles }; delete br[id]; return { ...u, boardRoles: br }; }));
    if (page === 'board-' + id) setPage('dashboard');
    fb('Eliminado');
    setConfirmDeleteBoard(null);
  };

  const saveCols = (cols: Column[]) => {
    setBoards(p => p.map(b => b.id === manageCols!.id ? { ...b, columns: cols } : b));
    fb('Carriles guardados');
    setManageCols(null);
  };

  const saveCF = (fields: CustomField[]) => {
    setBoards(p => p.map(b => b.id === manageCF!.id ? { ...b, customFields: fields } : b));
    fb('Campos guardados');
    setManageCF(null);
  };

  const saveField = (f: CustomField, bid: string, oldBid?: string) => {
    setBoards(p => p.map(b => {
      let nf = [...(b.customFields || [])];
      if (b.id === bid) {
        const idx = nf.findIndex(x => x.id === f.id);
        if (idx > -1) nf[idx] = f; else nf.push(f);
      } else if (b.id === oldBid) {
        nf = nf.filter(x => x.id !== f.id);
      }
      return { ...b, customFields: nf };
    }));
    fb('Campo guardado');
    setEditField(null);
    setShowFieldForm(false);
  };

  const deleteField = () => {
    if (!confirmDeleteField) return;
    setBoards(p => p.map(b => b.id === confirmDeleteField.boardId ? { ...b, customFields: b.customFields.filter(f => f.id !== confirmDeleteField.id) } : b));
    fb('Campo eliminado');
    setConfirmDeleteField(null);
  };

  // Card CRUD
  const createCard = (data: { title: string; description: string; assigneeId: string; columnId: string; files: any[]; customData: Record<string, string> }) => {
    const b = createCardBoard!;
    const n = nextGlobalNum;
    const code = b.prefix + '-' + n;
    const assignee = users.find(u => u.id === data.assigneeId);
    const nc: Card = {
      id: generateId(), boardId: b.id, columnId: data.columnId, code, title: data.title, description: data.description,
      priority: '' as any, type: '', assigneeId: data.assigneeId, reporterId: me.id, reporterName: me.fullName,
      createdAt: new Date().toISOString(), modifiedBy: null, modifiedAt: null, deleted: false, closed: false, closedAt: null, closedBy: null,
      files: data.files || [], comments: [], customData: data.customData || {},
      assigneeHistory: [{ id: generateId(), assigneeId: data.assigneeId, assigneeName: assignee?.fullName || 'Desconocido', assignedAt: new Date().toISOString() }],
      moveHistory: [],
    };
    setCards(p => [...p, nc]);
    setNextGlobalNum(p => p + 1);
    fb(`${code} creado`);
    setCreateCardBoard(null);
  };

  const updateCard = (card: Card, upd: Partial<Card>) => {
    setCards(p => p.map(c => c.id === card.id ? { ...c, ...upd, modifiedBy: me.fullName, modifiedAt: new Date().toISOString() } : c));
  };

  const softDeleteCard = () => {
    if (!confirmDeleteCard) return;
    setCards(p => p.map(c => c.id === confirmDeleteCard.id ? { ...c, deleted: true, modifiedBy: me.fullName, modifiedAt: new Date().toISOString() } : c));
    fb(`${confirmDeleteCard.code} eliminado`);
    setConfirmDeleteCard(null);
    setViewCard(null);
  };

  const moveCard = (card: Card, colId: string) => {
    if (card.columnId === colId) return;
    const b = boards.find(x => x.id === card.boardId);
    const sc = [...(b?.columns || [])].sort((a, c) => a.order - c.order);
    const lastCol = sc[sc.length - 1];

    // If moving to last col, show close confirmation
    if (colId === lastCol?.id) {
      setCloseConfirm({ card, colId });
      return;
    }

    const fromCol = sc.find(c => c.id === card.columnId);
    const toCol = sc.find(c => c.id === colId);
    const entry = { id: generateId(), fromCol: fromCol?.name || '—', toCol: toCol?.name || '—', movedAt: new Date().toISOString() };
    setCards(p => p.map(c => c.id === card.id ? { ...c, columnId: colId, moveHistory: [...(c.moveHistory || []), entry], modifiedBy: me.fullName, modifiedAt: new Date().toISOString() } : c));
    fb(`Movido a ${toCol?.name || '—'}`);
  };

  const moveCardById = (cardId: string, colId: string) => {
    const card = cards.find(c => c.id === cardId);
    if (card) moveCard(card, colId);
  };

  const confirmCloseCase = () => {
    if (!closeConfirm) return;
    const { card, colId } = closeConfirm;
    const b = boards.find(x => x.id === card.boardId);
    const sc = [...(b?.columns || [])].sort((a, c) => a.order - c.order);
    const fromCol = sc.find(c => c.id === card.columnId);
    const toCol = sc.find(c => c.id === colId);
    const moveEntry = { id: generateId(), fromCol: fromCol?.name || '—', toCol: toCol?.name || '—', movedAt: new Date().toISOString() };
    setCards(p => p.map(c => c.id === card.id ? { ...c, columnId: colId, closed: true, closedAt: new Date().toISOString(), closedBy: me.fullName, moveHistory: [...(c.moveHistory || []), moveEntry], modifiedBy: me.fullName, modifiedAt: new Date().toISOString() } : c));
    fb(`${card.code} cerrado`);
    setCloseConfirm(null);
    setViewCard(null);
  };

  // Page title
  const pageTitle = page === 'dashboard' ? 'Inicio' : page === 'users' ? 'Usuarios' : page === 'boards' ? 'Tableros' : page === 'fields' ? 'Campos Personalizados' : page === 'cases' ? 'Todos los Casos' : page.startsWith('board-') ? boards.find(b => 'board-' + b.id === page)?.name || '' : '';

  const unames = users.filter(u => !editUser || u.id !== editUser.id).map(u => u.username.toLowerCase());
  const prefixes = boards.filter(b => !editBoard || b.id !== editBoard.id).map(b => b.prefix);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <div className="w-[260px] bg-card border-r border-border fixed top-0 left-0 bottom-0 flex flex-col z-20">
        <div className="py-5 px-[18px] border-b border-border">
          <h2 className="text-[16px] font-bold text-foreground">Allers</h2>
          <p className="text-[11px] text-text-muted mt-0.5">Sistema de Gestión</p>
        </div>
        <div className="py-3 px-2.5 flex-1 overflow-y-auto">
          <div className={`flex items-center gap-2.5 py-[9px] px-3 rounded-lg text-[13px] cursor-pointer select-none transition-all ${page === 'dashboard' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-surface-3 hover:text-foreground'}`}
            onClick={() => setPage('dashboard')}><Icons.home size={16} /><span>Inicio</span></div>
          <div className={`flex items-center gap-2.5 py-[9px] px-3 rounded-lg text-[13px] cursor-pointer select-none transition-all ${page === 'cases' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-surface-3 hover:text-foreground'}`}
            onClick={() => setPage('cases')}><Icons.list size={16} /><span>Todos los Casos</span></div>

          {isAdmin && (
            <>
              <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[1px] py-3 px-2.5">Administración</div>
              <div className={`flex items-center gap-2.5 py-[9px] px-3 rounded-lg text-[13px] cursor-pointer select-none transition-all ${page === 'users' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-surface-3 hover:text-foreground'}`}
                onClick={() => setPage('users')}><Icons.users size={16} /><span>Usuarios</span></div>
              <div className={`flex items-center gap-2.5 py-[9px] px-3 rounded-lg text-[13px] cursor-pointer select-none transition-all ${page === 'boards' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-surface-3 hover:text-foreground'}`}
                onClick={() => setPage('boards')}><Icons.settings size={16} /><span>Tableros</span></div>
              <div className={`flex items-center gap-2.5 py-[9px] px-3 rounded-lg text-[13px] cursor-pointer select-none transition-all ${page === 'fields' ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-surface-3 hover:text-foreground'}`}
                onClick={() => setPage('fields')}><Icons.fields size={16} /><span>Campos</span></div>
            </>
          )}

          <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[1px] py-3 px-2.5">Tableros</div>
          {visibleBoards.map(b => (
            <div key={b.id} className={`flex items-center gap-2.5 py-[9px] px-3 rounded-lg text-[13px] cursor-pointer select-none transition-all ${page === 'board-' + b.id ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-surface-3 hover:text-foreground'}`}
              onClick={() => setPage('board-' + b.id)}>
              <Icons.board size={16} />
              <span className="flex-1 truncate">{b.name}</span>
              {!isAdmin && me.boardRoles[b.id] && (
                <span className={`px-1.5 py-px rounded-full text-[9px] font-semibold ${me.boardRoles[b.id] === 'admin_tablero' ? 'bg-warning/10 text-warning' : me.boardRoles[b.id] === 'ejecutor' ? 'bg-primary/10 text-primary' : 'bg-surface-3 text-text-secondary'}`}>
                  {ROLE_LABELS[me.boardRoles[b.id]]}
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="py-3.5 px-[18px] border-t border-border flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[12px] font-bold shrink-0">{getInitials(me.fullName)}</div>
          <div className="flex-1 min-w-0">
            <div className="text-foreground font-semibold text-[13px] truncate">{me.fullName}</div>
            <div className="text-text-muted text-[11px]">{isAdmin ? 'Admin Total' : 'Usuario'}</div>
          </div>
          <button className="bg-transparent border-none text-text-muted cursor-pointer p-1 flex items-center hover:text-destructive" onClick={logout}><Icons.logout size={16} /></button>
        </div>
      </div>

      {/* Main */}
      <div className="ml-[260px] flex-1 min-h-screen">
        <div className="py-4 px-7 border-b border-border bg-card flex items-center justify-between sticky top-0 z-10">
          <h1 className="text-[18px] font-bold text-foreground">{pageTitle}</h1>
          <div className="flex gap-2 items-center">
            {feedback && <div className={`py-2 px-3.5 rounded-lg text-[13px] ${feedback.type === 'ok' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>{feedback.message}</div>}
          </div>
        </div>
        <div className="p-6 px-7">
          {page === 'dashboard' && <Dashboard users={users} boards={boards} cards={cards} />}
          {page === 'users' && isAdmin && <UserList users={users} me={me} boards={boards} onEdit={u => setEditUser(u)} onDelete={u => setConfirmDeleteUser(u)} onCreate={() => setShowCreateUser(true)} />}
          {page === 'boards' && isAdmin && <BoardManagement boards={boards} cards={cards} users={users} onCreate={() => setShowCreateBoard(true)} onEdit={b => setEditBoard(b)} onDelete={b => setConfirmDeleteBoard(b)} onColumns={b => setManageCols(b)} onCustomFields={b => setManageCF(b)} />}
          {page === 'cases' && <CaseList cards={visibleCards} boards={boards} users={users} onCardClick={c => setViewCard(c)} />}
          {page === 'fields' && isAdmin && <CustomFieldList boards={boards} onAdd={() => setShowFieldForm(true)} onEdit={f => setEditField(f)} onDelete={f => setConfirmDeleteField(f)} />}
          {page.startsWith('board-') && (() => {
            const b = boards.find(x => 'board-' + x.id === page);
            if (!b) return null;
            if (!isAdmin && !me.boardRoles[b.id]) return <div className="text-center py-16">🔒 Sin acceso</div>;
            return <Kanban board={b} cards={cards} users={users} me={me} onColumns={x => setManageCols(x)} onCreate={x => setCreateCardBoard(x)} onCardClick={c => setViewCard(c)} onMoveCard={(cid, colId) => moveCardById(cid, colId)} onCloseCase={x => setCloseConfirm(x)} />;
          })()}
        </div>
      </div>

      {/* Modals */}
      {(showCreateUser || editUser) && <UserForm user={editUser} onSave={saveUser} onClose={() => { setEditUser(null); setShowCreateUser(false); }} existingUsernames={unames} me={me} boards={boards} />}
      {(showCreateBoard || editBoard) && <BoardForm board={editBoard} onSave={saveBoard} onClose={() => { setShowCreateBoard(false); setEditBoard(null); }} existingPrefixes={prefixes} />}
      {manageCols && <ColumnManager board={manageCols} cards={cards} onSave={saveCols} onClose={() => setManageCols(null)} />}
      {manageCF && <CustomFieldManager board={manageCF} onSave={saveCF} onClose={() => setManageCF(null)} />}
      {(showFieldForm || editField) && <FieldForm field={editField} boards={boards} onSave={saveField} onClose={() => { setShowFieldForm(false); setEditField(null); }} />}
      {createCardBoard && <CreateCard board={createCardBoard} users={users} me={me} onSave={createCard} onClose={() => setCreateCardBoard(null)} />}
      {viewCard && (() => { const b = boards.find(x => x.id === viewCard.boardId); const fresh = cards.find(c => c.id === viewCard.id) || viewCard; return <CardDetail card={fresh} board={b} users={users} me={me} onUpdate={updateCard} onDelete={c => setConfirmDeleteCard(c)} onMove={(c, colId) => moveCard(c, colId)} onClose={() => setViewCard(null)} />; })()}

      {confirmDeleteUser && <Confirm title="Eliminar Usuario" msg={`¿Eliminar "${confirmDeleteUser.fullName}"?`} onConfirm={deleteUser} onCancel={() => setConfirmDeleteUser(null)} />}
      {confirmDeleteBoard && <Confirm title="Eliminar Tablero" msg={`¿Eliminar "${confirmDeleteBoard.name}"?`} onConfirm={deleteBoard} onCancel={() => setConfirmDeleteBoard(null)} />}
      {confirmDeleteField && <Confirm title="Eliminar Campo" msg={`¿Eliminar "${confirmDeleteField.name}" del tablero "${confirmDeleteField.boardName}"?`} onConfirm={deleteField} onCancel={() => setConfirmDeleteField(null)} />}
      {confirmDeleteCard && <Confirm title="Eliminar Caso" msg={`"${confirmDeleteCard.code}" se ocultará. Los datos quedan.`} label="Eliminar" onConfirm={softDeleteCard} onCancel={() => setConfirmDeleteCard(null)} />}
      {closeConfirm && <Confirm title="Cerrar Caso" msg={`¿Cerrar "${closeConfirm.card.code}"? El caso desaparecerá del tablero y nadie podrá editarlo.`} label="Sí, cerrar caso" onConfirm={confirmCloseCase} onCancel={() => setCloseConfirm(null)} />}
    </div>
  );
};

export default Index;
