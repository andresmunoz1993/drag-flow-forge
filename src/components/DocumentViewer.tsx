import React, { useEffect, useState } from 'react';
import type { ClientDocument } from '@/types';
import { apiGetDocumentos, apiGetDocumentoPdf } from '@/lib/api';
import { Icons } from './Icons';
import { formatDate } from '@/lib/storage';

interface DocumentViewerProps {
  cardId: string;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ cardId }) => {
  const [docs, setDocs]     = useState<ClientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ClientDocument | null>(null);
  const [pdfUrl, setPdfUrl]   = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiGetDocumentos(cardId)
      .then(setDocs)
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, [cardId]);

  // Limpiar object URL al desmontar
  useEffect(() => {
    return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); };
  }, [pdfUrl]);

  const openPdf = async (doc: ClientDocument) => {
    if (selected?.id === doc.id) {
      // Cerrar: limpiar URL actual
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setSelected(null);
      setPdfUrl(null);
      return;
    }
    // Revocar URL anterior antes de crear la nueva (evita memory leak)
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setSelected(doc);
    setPdfUrl(null);
    setPdfLoading(true);
    try {
      const blob = await apiGetDocumentoPdf(doc.id);
      const url  = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch {
      setPdfUrl(null);
    } finally {
      setPdfLoading(false);
    }
  };

  const downloadPdf = async (doc: ClientDocument) => {
    setPdfLoading(true);
    try {
      const blob = await apiGetDocumentoPdf(doc.id);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = doc.nombreArchivo;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center gap-2 py-2 text-[12px] text-text-muted">
      <Icons.spinner size={13} className="animate-spin" /> Cargando documentos...
    </div>
  );

  if (!docs.length) return (
    <div className="text-[12px] text-text-muted italic py-1">
      Sin documentos sincronizados.
    </div>
  );

  // Agrupar por tipo
  const byTipo = docs.reduce<Record<string, ClientDocument[]>>((acc, d) => {
    if (!acc[d.tipo]) acc[d.tipo] = [];
    acc[d.tipo].push(d);
    return acc;
  }, {});

  return (
    <div>
      {Object.entries(byTipo).map(([tipo, items]) => (
        <div key={tipo} className="mb-3">
          <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1.5">{tipo}</div>
          {items.map(doc => (
            <div key={doc.id}>
              <div className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-surface-3 group">
                <Icons.clip size={12} className="text-destructive shrink-0" />
                <span className="flex-1 text-[12px] text-foreground truncate">{doc.nombreArchivo}</span>
                <span className="text-[10px] text-text-muted hidden group-hover:block">{formatDate(doc.fechaSincronizacion)}</span>
                <button
                  title="Ver PDF"
                  className={`p-1 rounded text-[11px] cursor-pointer transition-colors ${selected?.id === doc.id ? 'text-primary' : 'text-text-muted hover:text-foreground'}`}
                  onClick={() => openPdf(doc)}
                >
                  <Icons.eye size={13} />
                </button>
                <button
                  title="Descargar"
                  className="p-1 rounded text-text-muted hover:text-foreground cursor-pointer"
                  onClick={() => downloadPdf(doc)}
                >
                  <Icons.dl size={13} />
                </button>
              </div>

              {/* Visor inline */}
              {selected?.id === doc.id && (
                <div className="mt-1 mb-2 rounded-lg border border-border overflow-hidden bg-surface-2">
                  {pdfLoading ? (
                    <div className="flex items-center justify-center h-[400px] gap-2 text-[12px] text-text-muted">
                      <Icons.spinner size={16} className="animate-spin" /> Cargando PDF...
                    </div>
                  ) : pdfUrl ? (
                    <embed src={pdfUrl} type="application/pdf" width="100%" height="500px" />
                  ) : (
                    <div className="flex items-center justify-center h-[120px] text-[12px] text-destructive gap-2">
                      <Icons.alert size={14} /> No se pudo cargar el archivo.
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default DocumentViewer;
