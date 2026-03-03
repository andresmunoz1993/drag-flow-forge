import type { CustomField } from '@/types';

/** Calcula los campos con fórmula y los aplica sobre customData */
export const applyFormulaFields = (
  fields: CustomField[],
  customData: Record<string, string>,
  createdAt: string,
): Record<string, string> => {
  const cd = { ...customData };
  fields.forEach(cf => {
    if (cf.formula === 'createdAt' && cf.formulaDays !== undefined) {
      const d = new Date(createdAt);
      d.setDate(d.getDate() + cf.formulaDays);
      cd[cf.id] = d.toISOString().split('T')[0];
    }
  });
  return cd;
};

export const generateId = (): string =>
  Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

export const formatDate = (d: string | null | undefined): string => {
  if (!d) return '—';
  const dt = new Date(d);
  return (
    dt.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' +
    dt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
  );
};

export const formatShortDate = (d: string | null | undefined): string => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const getInitials = (name: string): string =>
  name ? name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : '?';

export const formatSize = (bytes: number): string =>
  bytes < 1024 ? bytes + 'B' : bytes < 1048576 ? (bytes / 1024).toFixed(1) + 'KB' : (bytes / 1048576).toFixed(1) + 'MB';

export const getFileExt = (name: string): string =>
  name.split('.').pop()?.toUpperCase().substring(0, 4) || '';

export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const downloadFile = (data: string, name: string): void => {
  const a = document.createElement('a');
  a.href = data;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};
