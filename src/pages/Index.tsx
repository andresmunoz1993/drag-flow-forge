import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { User, Board, Card, Column, Comment, CustomField, SapConfig, SpAutoImportConfig, SpCaseRecord } from '@/types';
import { ROLE_LABELS } from '@/types';
import { generateId, getInitials, applyFormulaFields } from '@/lib/storage';
import {
  apiGetUsers, apiCreateUser, apiUpdateUser, apiDeleteUser,
  apiGetBoards, apiCreateBoard, apiUpdateBoard, apiDeleteBoard, apiSaveColumns,
  apiGetCards, apiCreateCard, apiUpdateCard, apiDeleteCard,
  apiCreateComment, apiUpdateComment, apiDeleteComment,
  apiCreateCustomField, apiUpdateCustomField, apiDeleteCustomField,
  apiGetMe, apiCheckCards, apiGetSpRecords, apiSyncSftp, setAuthToken, getAuthToken,
} from '@/lib/api';
import { Icons } from '@/components/Icons';

import Login from '@/components/Login';
import Dashboard from '@/components/Dashboard';
import UserList from '@/components/UserList';
import UserForm from '@/components/UserForm';
import BoardManagement, { BoardForm, ColumnManager, CustomFieldManager, LandingManager, SapManager, SpAutoImportManager } from '@/components/BoardManagement';
import Kanban from '@/components/Kanban';
import CreateCard from '@/components/CreateCard';
import CardDetail from '@/components/CardDetail';
import CaseList from '@/components/CaseList';
import CustomFieldList, { FieldForm } from '@/components/CustomFieldList';
import EmbeddedLandingForm from '@/components/EmbeddedLandingForm';
import Confirm from '@/components/Confirm';

const Index = () => {
  // ── State ──────────────────────────────────────────────────────────────────
  const [users,  setUsers]  = useState<User[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [cards,  setCards]  = useState<Card[]>([]);

  const [me,        setMe]        = useState<User | null>(null);
  const [page,      setPage]      = useState('dashboard');
  const [isLoading, setIsLoading] = useState(false);

  // Modal states
  const [editUser,            setEditUser]            = useState<User | null>(null);
  const [showCreateUser,      setShowCreateUser]      = useState(false);
  const [showCreateBoard,     setShowCreateBoard]     = useState(false);
  const [editBoard,           setEditBoard]           = useState<Board | null>(null);
  const [manageCols,          setManageCols]          = useState<Board | null>(null);
  const [manageCF,            setManageCF]            = useState<Board | null>(null);
  const [createCardBoard,     setCreateCardBoard]     = useState<Board | null>(null);
  const [viewCard,            setViewCard]            = useState<Card | null>(null);
  const [confirmDeleteUser,   setConfirmDeleteUser]   = useState<User | null>(null);
  const [confirmDeleteBoard,  setConfirmDeleteBoard]  = useState<Board | null>(null);
  const [confirmDeleteCard,   setConfirmDeleteCard]   = useState<Card | null>(null);
  const [closeConfirm,        setCloseConfirm]        = useState<{ card: Card; colId: string } | null>(null);
  const [feedback,            setFeedback]            = useState<{ type: string; message: string } | null>(null);
  const [showFieldForm,       setShowFieldForm]       = useState(false);
  const [editField,           setEditField]           = useState<(CustomField & { boardId?: string }) | null>(null);
  const [confirmDeleteField,  setConfirmDeleteField]  = useState<(CustomField & { boardId: string; boardName: string }) | null>(null);
  const [manageLanding,       setManageLanding]       = useState<Board | null>(null);
  const [manageSap,           setManageSap]           = useState<Board | null>(null);
  const [manageSpAutoImport,  setManageSpAutoImport]  = useState<Board | null>(null);
  const [isSpImporting,       setIsSpImporting]       = useState<string | null>(null);
  const [isSyncingDocumentos, setIsSyncingDocumentos] = useState(false);
  const [autoLoginDone,       setAutoLoginDone]       = useState(false);

  // Polling state
  const lastCheckRef = useRef<{ count: number; lastChange: string | null } | null>(null);

  // ── Auto-login desde JWT ──────────────────────────────────────────────────
  useEffect(() => {
    const token = getAuthToken();
    if (!token) { setAutoLoginDone(true); return; }
    apiGetMe()
      .then(async (user) => {
        setMe(user);
        if (user.token) setAuthToken(user.token);
        const [allUsers, allBoards, allCards] = await Promise.all([
          apiGetUsers(), apiGetBoards(), apiGetCards(),
        ]);
        setUsers(allUsers); setBoards(allBoards); setCards(allCards);
        setPage('dashboard');
      })
      .catch(() => { setAuthToken(null); })
      .finally(() => setAutoLoginDone(true));
  }, []);

  // ── Polling: sincronizar cards cada 15s (pausa cuando el tab no está activo) ─
  useEffect(() => {
    if (!me || !page.startsWith('board-')) return;
    const boardId = page.replace('board-', '');

    const poll = async () => {
      // No hacer requests si el tab está oculto (ahorra BD y red)
      if (document.visibilityState === 'hidden') return;
      try {
        const check = await apiCheckCards(boardId);
        const prev = lastCheckRef.current;
        if (prev && (check.count !== prev.count || check.lastChange !== prev.lastChange)) {
          const freshCards = await apiGetCards(boardId);
          setCards(old => {
            const otherBoardCards = old.filter(c => c.boardId !== boardId);
            return [...otherBoardCards, ...freshCards];
          });
        }
        lastCheckRef.current = check;
      } catch { /* ignorar errores de polling */ }
    };

    // Reanudar inmediatamente al volver al tab
    const onVisible = () => { if (document.visibilityState === 'visible') poll(); };
    document.addEventListener('visibilitychange', onVisible);

    poll();
    const interval = setInterval(poll, 15000);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      lastCheckRef.current = null;
    };
  }, [me, page]);

  // Feedback auto-clear
  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(t);
    }
  }, [feedback]);

  const fb     = (m: string) => setFeedback({ type: 'ok',    message: m });
  const fbErr  = (m: string) => setFeedback({ type: 'error', message: m });
  const errMsg = (err: unknown) => err instanceof Error ? err.message : 'Error desconocido';

  // ── Auth ───────────────────────────────────────────────────────────────────
  const login = async (u: User) => {
    setMe(u);
    setIsLoading(true);
    try {
      const [allUsers, allBoards, allCards] = await Promise.all([
        apiGetUsers(),
        apiGetBoards(),
        apiGetCards(),
      ]);
      setUsers(allUsers);
      setBoards(allBoards);
      setCards(allCards);
      setPage('dashboard');
    } catch (err) {
      fbErr('Error al cargar datos: ' + errMsg(err));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setAuthToken(null);
    setMe(null);
    setUsers([]);
    setBoards([]);
    setCards([]);
    setPage('dashboard');
  };

  // Mostrar loading mientras verifica JWT
  if (!autoLoginDone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Icons.spinner size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!me) return <Login onLogin={login} />;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background gap-3 text-text-muted">
        <Icons.spinner size={20} className="animate-spin" />
        <span className="text-[14px]">Cargando datos…</span>
      </div>
    );
  }

  const isAdmin       = me.isAdminTotal;
  const visibleBoards = isAdmin ? boards : boards.filter(b => me.boardRoles[b.id]);
  const visibleCards  = isAdmin ? cards  : cards.filter(c => me.boardRoles[c.boardId]);

  // ── User CRUD ──────────────────────────────────────────────────────────────
  const saveUser = async (form: Partial<User>) => {
    try {
      if (editUser) {
        const updated = await apiUpdateUser(editUser.id, form as any);
        setUsers(p => p.map(u => u.id === editUser.id ? updated : u));
        if (editUser.id === me.id) setMe(updated);
        fb('Actualizado');
        setEditUser(null);
      } else {
        const created = await apiCreateUser(form as any);
        setUsers(p => [...p, created]);
        fb('Creado');
        setShowCreateUser(false);
      }
    } catch (err) { fbErr(errMsg(err)); }
  };

  const deleteUser = async () => {
    if (!confirmDeleteUser) return;
    try {
      await apiDeleteUser(confirmDeleteUser.id);
      setUsers(p => p.filter(u => u.id !== confirmDeleteUser.id));
      fb('Eliminado');
      setConfirmDeleteUser(null);
    } catch (err) { fbErr(errMsg(err)); }
  };

  // ── Board CRUD ─────────────────────────────────────────────────────────────
  const saveBoard = async (data: { name: string; prefix: string }) => {
    try {
      if (editBoard) {
        const updated = await apiUpdateBoard(editBoard.id, data);
        setBoards(p => p.map(b => b.id === editBoard.id ? updated : b));
        fb('Actualizado');
        setEditBoard(null);
      } else {
        const created = await apiCreateBoard(data);
        setBoards(p => [...p, created]);
        fb('Creado');
        setShowCreateBoard(false);
      }
    } catch (err) { fbErr(errMsg(err)); }
  };

  const deleteBoard = async () => {
    if (!confirmDeleteBoard) return;
    const id = confirmDeleteBoard.id;
    try {
      await apiDeleteBoard(id);
      setBoards(p => p.filter(b => b.id !== id));
      setCards(p => p.filter(c => c.boardId !== id));
      if (page === 'board-' + id) setPage('dashboard');
      fb('Eliminado');
      setConfirmDeleteBoard(null);
    } catch (err) { fbErr(errMsg(err)); }
  };

  const saveCols = async (cols: Column[]) => {
    if (!manageCols) return;
    try {
      const savedCols = await apiSaveColumns(manageCols.id, cols);
      setBoards(p => p.map(b => b.id === manageCols.id ? { ...b, columns: savedCols } : b));
      fb('Carriles guardados');
      setManageCols(null);
    } catch (err) { fbErr(errMsg(err)); }
  };

  const saveLanding = async (landing: import('@/types').BoardLanding) => {
    if (!manageLanding) return;
    try {
      const updated = await apiUpdateBoard(manageLanding.id, { landing });
      setBoards(p => p.map(b => b.id === manageLanding.id ? updated : b));
      fb('Landing guardado');
      setManageLanding(null);
    } catch (err) { fbErr(errMsg(err)); }
  };

  const saveSap = async (config: SapConfig | undefined) => {
    if (!manageSap) return;
    try {
      const updated = await apiUpdateBoard(manageSap.id, { sap: config });
      setBoards(p => p.map(b => b.id === manageSap.id ? updated : b));
      fb(config ? 'Integración SAP guardada' : 'Integración SAP desactivada');
      setManageSap(null);
    } catch (err) { fbErr(errMsg(err)); }
  };

  const saveSpAutoImport = async (config: SpAutoImportConfig | undefined) => {
    if (!manageSpAutoImport) return;
    try {
      const updated = await apiUpdateBoard(manageSpAutoImport.id, { spAutoImport: config });
      setBoards(p => p.map(b => b.id === manageSpAutoImport.id ? updated : b));
      fb(config?.enabled ? 'Importación SP habilitada' : 'Importación SP desactivada');
      setManageSpAutoImport(null);
    } catch (err) { fbErr(errMsg(err)); }
  };

  // ── Custom Fields ──────────────────────────────────────────────────────────
  const saveCF = async (fields: CustomField[]) => {
    if (!manageCF) return;
    const board = boards.find(b => b.id === manageCF.id)!;
    const existing    = board?.customFields || [];
    const existingIds = new Set(existing.map(f => f.id));
    const newIds      = new Set(fields.map(f => f.id));
    try {
      for (const f of existing) {
        if (!newIds.has(f.id)) await apiDeleteCustomField(f.id);
      }
      const savedFields: CustomField[] = [];
      for (const f of fields) {
        if (existingIds.has(f.id)) {
          savedFields.push(await apiUpdateCustomField(f.id, f));
        } else {
          savedFields.push(await apiCreateCustomField({ ...f, boardId: manageCF.id }));
        }
      }
      setBoards(p => p.map(b => b.id === manageCF.id ? { ...b, customFields: savedFields } : b));
      fb('Campos guardados');
      setManageCF(null);
    } catch (err) { fbErr(errMsg(err)); }
  };

  const saveField = async (f: CustomField, bid: string, oldBid?: string) => {
    try {
      const board = boards.find(b => b.id === bid)!;
      const existingIds = new Set((board?.customFields || []).map(cf => cf.id));
      let saved: CustomField;
      if (existingIds.has(f.id)) {
        saved = await apiUpdateCustomField(f.id, f);
      } else {
        saved = await apiCreateCustomField({ ...f, boardId: bid });
      }
      if (oldBid && oldBid !== bid) await apiDeleteCustomField(f.id);
      setBoards(p => p.map(b => {
        let nf = [...(b.customFields || [])];
        if (b.id === bid) {
          const idx = nf.findIndex(x => x.id === f.id);
          if (idx > -1) nf[idx] = saved; else nf.push(saved);
        } else if (b.id === oldBid) {
          nf = nf.filter(x => x.id !== f.id);
        }
        return { ...b, customFields: nf };
      }));
      fb('Campo guardado');
      setEditField(null);
      setShowFieldForm(false);
    } catch (err) { fbErr(errMsg(err)); }
  };

  const deleteField = async () => {
    if (!confirmDeleteField) return;
    try {
      await apiDeleteCustomField(confirmDeleteField.id);
      setBoards(p => p.map(b => b.id === confirmDeleteField.boardId
        ? { ...b, customFields: b.customFields.filter(f => f.id !== confirmDeleteField.id) }
        : b));
      fb('Campo eliminado');
      setConfirmDeleteField(null);
    } catch (err) { fbErr(errMsg(err)); }
  };

  // ── Card CRUD ──────────────────────────────────────────────────────────────
  const createCard = async (data: {
    title: string; description: string; assigneeId: string;
    columnId: string; files: any[]; customData: Record<string, string>; clientRef?: string;
  }) => {
    const b         = createCardBoard!;
    const createdAt = new Date().toISOString();
    const assignee  = users.find(u => u.id === data.assigneeId);
    const customData = b.landing?.enabled
      ? applyFormulaFields(b.customFields || [], data.customData || {}, createdAt)
      : (data.customData || {});
    try {
      const newCard = await apiCreateCard({
        boardId: b.id, columnId: data.columnId,
        title: data.title, description: data.description,
        priority: '' as any, type: '',
        assigneeId: data.assigneeId,
        reporterId: me.id, reporterName: me.fullName,
        createdAt, modifiedBy: null, modifiedAt: null,
        deleted: false, closed: false, closedAt: null, closedBy: null,
        files: data.files || [], comments: [], customData,
        assigneeHistory: [{ id: generateId(), assigneeId: data.assigneeId, assigneeName: assignee?.fullName || 'Desconocido', assignedAt: createdAt }],
        moveHistory: [],
        clientRef: data.clientRef,
      });
      setCards(p => [...p, newCard]);
      fb(`${newCard.code} creado`);
      setCreateCardBoard(null);
    } catch (err) { fbErr(errMsg(err)); }
  };

  const createCardFromLanding = async (board: Board, data: {
    title: string; description: string; assigneeId: string;
    columnId: string; files: any[]; customData: Record<string, string>;
  }): Promise<string> => {
    const createdAt  = new Date().toISOString();
    const customData = applyFormulaFields(board.customFields || [], data.customData || {}, createdAt);
    const assignee   = users.find(u => u.id === data.assigneeId);
    const newCard = await apiCreateCard({
      boardId: board.id, columnId: data.columnId,
      title: data.title, description: data.description,
      priority: '' as any, type: '',
      assigneeId: data.assigneeId,
      reporterId: 'external', reporterName: 'Portal Externo',
      createdAt, modifiedBy: null, modifiedAt: null,
      deleted: false, closed: false, closedAt: null, closedBy: null,
      files: data.files || [], comments: [], customData,
      assigneeHistory: [{ id: generateId(), assigneeId: data.assigneeId, assigneeName: assignee?.fullName || 'Desconocido', assignedAt: createdAt }],
      moveHistory: [],
    });
    setCards(p => [...p, newCard]);
    fb(`${newCard.code} creado desde formulario`);
    return newCard.code;
  };

  /**
   * updateCard — maneja todas las actualizaciones de un card, incluyendo
   * cambios en comentarios (crea/modifica/elimina vía API de comments).
   */
  const updateCard = async (card: Card, upd: Partial<Card>) => {
    const now = new Date().toISOString();
    try {
      let latestComments: Comment[] = card.comments;

      // Sincronizar comentarios si cambiaron
      if (upd.comments !== undefined) {
        const oldById = new Map((card.comments || []).map(c => [c.id, c]));
        const newIds  = new Set(upd.comments.map(c => c.id));
        // Eliminar removidos
        for (const c of (card.comments || [])) {
          if (!newIds.has(c.id)) await apiDeleteComment(c.id);
        }
        // Crear o actualizar
        const result: Comment[] = [];
        for (const c of upd.comments) {
          if (oldById.has(c.id)) {
            result.push(await apiUpdateComment(c.id, c));
          } else {
            result.push(await apiCreateComment(card.id, c));
          }
        }
        latestComments = result;
      }

      // Actualizar campos del card
      const { comments: _c, ...cardFields } = upd as any;
      if (Object.keys(cardFields).length > 0) {
        const saved = await apiUpdateCard(card.id, {
          ...cardFields,
          modifiedBy: me.fullName,
          modifiedAt: now,
        });
        setCards(p => p.map(c => c.id === card.id ? { ...saved, comments: latestComments } : c));
      } else {
        // Solo comentarios cambiaron
        setCards(p => p.map(c => c.id === card.id
          ? { ...c, comments: latestComments, modifiedBy: me.fullName, modifiedAt: now }
          : c));
      }
    } catch (err) { fbErr(errMsg(err)); }
  };

  const softDeleteCard = async () => {
    if (!confirmDeleteCard) return;
    try {
      await apiDeleteCard(confirmDeleteCard.id, me.fullName);
      setCards(p => p.map(c => c.id === confirmDeleteCard.id
        ? { ...c, deleted: true, modifiedBy: me.fullName, modifiedAt: new Date().toISOString() }
        : c));
      fb(`${confirmDeleteCard.code} eliminado`);
      setConfirmDeleteCard(null);
      setViewCard(null);
    } catch (err) { fbErr(errMsg(err)); }
  };

  const moveCard = async (card: Card, colId: string) => {
    if (card.columnId === colId) return;
    const b       = boards.find(x => x.id === card.boardId);
    const sc      = [...(b?.columns || [])].sort((a, c) => a.order - c.order);
    const lastCol = sc[sc.length - 1];

    if (colId === lastCol?.id) {
      setCloseConfirm({ card, colId });
      return;
    }

    const fromCol    = sc.find(c => c.id === card.columnId);
    const toCol      = sc.find(c => c.id === colId);
    const entry      = { id: generateId(), fromCol: fromCol?.name || '—', toCol: toCol?.name || '—', movedAt: new Date().toISOString() };
    const newHistory = [...(card.moveHistory || []), entry];

    try {
      const saved = await apiUpdateCard(card.id, {
        columnId: colId,
        moveHistory: newHistory,
        modifiedBy: me.fullName,
        modifiedAt: new Date().toISOString(),
      });
      setCards(p => p.map(c => c.id === card.id ? { ...saved, comments: c.comments } : c));
      fb(`Movido a ${toCol?.name || '—'}`);
    } catch (err) { fbErr(errMsg(err)); }
  };

  const moveCardById = (cardId: string, colId: string) => {
    const card = cards.find(c => c.id === cardId);
    if (card) moveCard(card, colId);
  };

  const confirmCloseCase = async () => {
    if (!closeConfirm) return;
    const { card, colId } = closeConfirm;
    const b         = boards.find(x => x.id === card.boardId);
    const sc        = [...(b?.columns || [])].sort((a, c) => a.order - c.order);
    const now       = new Date().toISOString();
    const fromCol   = sc.find(c => c.id === card.columnId);
    const toCol     = sc.find(c => c.id === colId);
    const moveEntry = { id: generateId(), fromCol: fromCol?.name || '—', toCol: toCol?.name || '—', movedAt: now };
    try {
      const saved = await apiUpdateCard(card.id, {
        columnId: colId,
        closed: true, closedAt: now, closedBy: me.fullName,
        moveHistory: [...(card.moveHistory || []), moveEntry],
        modifiedBy: me.fullName, modifiedAt: now,
      });
      setCards(p => p.map(c => c.id === card.id ? { ...saved, comments: c.comments } : c));
      fb(`${card.code} cerrado`);
      setCloseConfirm(null);
      setViewCard(null);
    } catch (err) { fbErr(errMsg(err)); }
  };

  // ── SP Import ──────────────────────────────────────────────────────────────
  const importFromSp = async (board: Board) => {
    if (isSpImporting) return;
    const config = board.spAutoImport;
    if (!config?.enabled) return;

    setIsSpImporting(board.id);
    setFeedback({ type: 'ok', message: 'Consultando SP...' });

    try {
      const { records } = await apiGetSpRecords(board.id, config.spName);
      if (!records.length) { fb('El SP no devolvió registros.'); return; }

      const importedIds = new Set(cards.filter(c => c.spExternalId).map(c => c.spExternalId!));
      const newRecords  = records.filter(r => !importedIds.has(r.externalId));
      if (!newRecords.length) { fb('Todos los registros del SP ya estaban importados.'); return; }

      const sortedCols = [...board.columns].sort((a, b) => a.order - b.order);
      const targetCol  = config.targetColumnId
        ? (sortedCols.find(c => c.id === config.targetColumnId) ?? sortedCols[0])
        : sortedCols[0];
      if (!targetCol) { fb('Error: el tablero no tiene carriles configurados.'); return; }

      const assignee  = users.find(u => u.id === config.defaultAssigneeId);
      const createdAt = new Date().toISOString();
      const newCards: Card[] = [];

      for (const rec of newRecords) {
        const rawCustomData: Record<string, string> = {};
        if (rec.customData) {
          (board.customFields || []).forEach(cf => {
            const val = rec.customData![cf.name];
            if (val !== undefined) rawCustomData[cf.id] = String(val);
          });
        }
        const finalCustomData = applyFormulaFields(board.customFields || [], rawCustomData, createdAt);
        const newCard = await apiCreateCard({
          boardId: board.id, columnId: targetCol.id,
          title: rec.title, description: rec.description ?? '',
          priority: '' as any, type: '',
          assigneeId: config.defaultAssigneeId,
          reporterId: me.id, reporterName: me.fullName,
          createdAt, modifiedBy: null, modifiedAt: null,
          deleted: false, closed: false, closedAt: null, closedBy: null,
          files: [], comments: [], customData: finalCustomData,
          assigneeHistory: [{ id: generateId(), assigneeId: config.defaultAssigneeId, assigneeName: assignee?.fullName ?? 'Desconocido', assignedAt: createdAt }],
          moveHistory: [],
          spExternalId: rec.externalId,
        });
        newCards.push(newCard);
      }
      setCards(p => [...p, ...newCards]);
      fb(`${newCards.length} caso${newCards.length !== 1 ? 's' : ''} importado${newCards.length !== 1 ? 's' : ''} desde SP`);
    } catch (err) {
      fbErr(`Error SP: ${errMsg(err)}`);
    } finally {
      setIsSpImporting(null);
    }
  };

  const syncDocumentos = async () => {
    if (isSyncingDocumentos) return;
    setIsSyncingDocumentos(true);
    setFeedback({ type: 'ok', message: 'Sincronizando documentos SFTP...' });
    try {
      const result = await apiSyncSftp();
      fb(`Sync completado: ${result.imported} nuevos, ${result.skipped} existentes${result.errors.length ? ` (${result.errors.length} errores)` : ''}`);
    } catch (err) {
      fbErr(`Error SFTP: ${errMsg(err)}`);
    } finally {
      setIsSyncingDocumentos(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const pageTitle = page === 'dashboard' ? 'Inicio'
    : page === 'users'   ? 'Usuarios'
    : page === 'boards'  ? 'Tableros'
    : page === 'fields'  ? 'Campos Personalizados'
    : page === 'cases'   ? 'Todos los Casos'
    : page.startsWith('board-') ? boards.find(b => 'board-' + b.id === page)?.name || ''
    : page.startsWith('form-')  ? (boards.find(b => 'form-' + b.id === page)?.name || 'Formulario')
    : '';

  const unames   = users.filter(u => !editUser  || u.id !== editUser.id).map(u => u.username.toLowerCase());
  const prefixes = boards.filter(b => !editBoard || b.id !== editBoard.id).map(b => b.prefix);

  // ── Render ─────────────────────────────────────────────────────────────────
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

          {(() => {
            const formBoards = visibleBoards.filter(b => b.landing?.enabled);
            if (!formBoards.length) return null;
            return (
              <>
                <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[1px] py-3 px-2.5">Formularios</div>
                {formBoards.map(b => (
                  <div key={b.id} className={`flex items-center gap-2.5 py-[9px] px-3 rounded-lg text-[13px] cursor-pointer select-none transition-all ${page === 'form-' + b.id ? 'bg-success/10 text-success' : 'text-text-secondary hover:bg-surface-3 hover:text-foreground'}`}
                    onClick={() => setPage('form-' + b.id)}>
                    <Icons.globe size={16} />
                    <span className="flex-1 truncate">{b.name}</span>
                  </div>
                ))}
              </>
            );
          })()}
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
            {isAdmin && (
              <button
                className={`flex items-center gap-1.5 px-3 py-[7px] rounded-md text-[12px] font-semibold border transition-colors ${isSyncingDocumentos ? 'bg-primary/10 text-primary border-primary/30 cursor-not-allowed opacity-70' : 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20'}`}
                onClick={syncDocumentos}
                disabled={isSyncingDocumentos}
                title="Sincronizar documentos PDF desde servidor SFTP">
                {isSyncingDocumentos
                  ? <><Icons.spinner size={13} className="animate-spin" /> Sincronizando...</>
                  : <><Icons.sync size={13} /> Sync SFTP</>}
              </button>
            )}
          </div>
        </div>
        <div className="p-6 px-7">
          {page === 'dashboard' && <Dashboard users={users} boards={boards} cards={cards} />}
          {page === 'users'  && isAdmin && <UserList users={users} me={me} boards={boards} onEdit={u => setEditUser(u)} onDelete={u => setConfirmDeleteUser(u)} onCreate={() => setShowCreateUser(true)} />}
          {page === 'boards' && isAdmin && <BoardManagement boards={boards} cards={cards} users={users} me={me} onCreate={() => setShowCreateBoard(true)} onEdit={b => setEditBoard(b)} onDelete={b => setConfirmDeleteBoard(b)} onColumns={b => setManageCols(b)} onCustomFields={b => setManageCF(b)} onLanding={b => setManageLanding(b)} onSap={b => setManageSap(b)} onSpAutoImport={b => setManageSpAutoImport(b)} />}
          {page === 'cases'  && <CaseList cards={visibleCards} boards={boards} users={users} onCardClick={c => setViewCard(c)} />}
          {page === 'fields' && isAdmin && <CustomFieldList boards={boards} onAdd={() => setShowFieldForm(true)} onEdit={f => setEditField(f)} onDelete={f => setConfirmDeleteField(f)} />}
          {page.startsWith('board-') && (() => {
            const b = boards.find(x => 'board-' + x.id === page);
            if (!b) return null;
            if (!isAdmin && !me.boardRoles[b.id]) return <div className="text-center py-16">🔒 Sin acceso</div>;
            return <Kanban board={b} cards={cards} users={users} me={me} onColumns={x => setManageCols(x)} onCreate={x => setCreateCardBoard(x)} onCardClick={c => setViewCard(c)} onMoveCard={(cid, colId) => moveCardById(cid, colId)} onCloseCase={x => setCloseConfirm(x)} onSpImport={b.spAutoImport?.enabled ? importFromSp : undefined} isSpImporting={isSpImporting === b.id} />;
          })()}
          {page.startsWith('form-') && (() => {
            const b = boards.find(x => 'form-' + x.id === page);
            if (!b || !b.landing?.enabled) return <div className="text-center py-16 text-text-muted">Formulario no disponible.</div>;
            return <EmbeddedLandingForm board={b} users={users} onCreateCard={data => createCardFromLanding(b, data)} />;
          })()}
        </div>
      </div>

      {/* Modals */}
      {(showCreateUser || editUser) && <UserForm user={editUser} onSave={saveUser} onClose={() => { setEditUser(null); setShowCreateUser(false); }} existingUsernames={unames} me={me} boards={boards} />}
      {(showCreateBoard || editBoard) && <BoardForm board={editBoard} onSave={saveBoard} onClose={() => { setShowCreateBoard(false); setEditBoard(null); }} existingPrefixes={prefixes} />}
      {manageCols && <ColumnManager board={manageCols} cards={cards} onSave={saveCols} onClose={() => setManageCols(null)} />}
      {manageLanding && <LandingManager board={manageLanding} onSave={saveLanding} onClose={() => setManageLanding(null)} />}
      {manageSap && isAdmin && <SapManager board={manageSap} onSave={saveSap} onClose={() => setManageSap(null)} />}
      {manageSpAutoImport && isAdmin && <SpAutoImportManager board={manageSpAutoImport} users={users} onSave={saveSpAutoImport} onClose={() => setManageSpAutoImport(null)} />}
      {manageCF && <CustomFieldManager board={manageCF} onSave={saveCF} onClose={() => setManageCF(null)} />}
      {(showFieldForm || editField) && <FieldForm field={editField} boards={boards} onSave={saveField} onClose={() => { setShowFieldForm(false); setEditField(null); }} />}
      {createCardBoard && <CreateCard board={createCardBoard} users={users} me={me} onSave={createCard} onClose={() => setCreateCardBoard(null)} />}
      {viewCard && (() => {
        const b     = boards.find(x => x.id === viewCard.boardId);
        const fresh = cards.find(c => c.id === viewCard.id) || viewCard;
        return <CardDetail card={fresh} board={b} users={users} me={me} onUpdate={updateCard} onDelete={c => setConfirmDeleteCard(c)} onMove={(c, colId) => moveCard(c, colId)} onClose={() => setViewCard(null)} />;
      })()}

      {confirmDeleteUser  && <Confirm title="Eliminar Usuario"  msg={`¿Eliminar "${confirmDeleteUser.fullName}"?`}  onConfirm={deleteUser}  onCancel={() => setConfirmDeleteUser(null)} />}
      {confirmDeleteBoard && <Confirm title="Eliminar Tablero"  msg={`¿Eliminar "${confirmDeleteBoard.name}"?`}     onConfirm={deleteBoard} onCancel={() => setConfirmDeleteBoard(null)} />}
      {confirmDeleteField && <Confirm title="Eliminar Campo"    msg={`¿Eliminar "${confirmDeleteField.name}" del tablero "${confirmDeleteField.boardName}"?`} onConfirm={deleteField} onCancel={() => setConfirmDeleteField(null)} />}
      {confirmDeleteCard  && <Confirm title="Eliminar Caso"     msg={`"${confirmDeleteCard.code}" se ocultará. Los datos quedan.`} label="Eliminar" onConfirm={softDeleteCard} onCancel={() => setConfirmDeleteCard(null)} />}
      {closeConfirm       && <Confirm title="Cerrar Caso"       msg={`¿Cerrar "${closeConfirm.card.code}"? El caso desaparecerá del tablero y nadie podrá editarlo.`} label="Sí, cerrar caso" onConfirm={confirmCloseCase} onCancel={() => setCloseConfirm(null)} />}
    </div>
  );
};

export default Index;
