import React, { useRef } from 'react';
import type { FileAttachment } from '@/types';
import { Icons } from './Icons';
import { generateId, readFileAsDataUrl, downloadFile, formatSize, getFileExt, MAX_FILE_SIZE } from '@/lib/storage';

interface FileUploadProps {
  files: FileAttachment[];
  onAdd?: (file: FileAttachment) => void;
  onRemove?: (id: string) => void;
  disabled?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ files, onAdd, onRemove, disabled }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onAdd) return;
    const fl = Array.from(e.target.files || []);
    for (const f of fl) {
      if (f.size > MAX_FILE_SIZE) { alert(`"${f.name}" >2MB`); continue; }
      const data = await readFileAsDataUrl(f);
      onAdd({ id: generateId(), name: f.name, size: f.size, type: f.type, data });
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      {!disabled && onAdd && (
        <label className="inline-flex items-center gap-1.5 py-[7px] px-3 bg-surface-3 border border-dashed border-border-strong rounded-md text-text-secondary text-[12px] font-medium cursor-pointer hover:bg-surface-4 hover:text-foreground transition-colors">
          <Icons.clip size={14} /><span>Adjuntar</span>
          <input ref={inputRef} type="file" multiple onChange={handleFiles} className="hidden" />
        </label>
      )}
      {files.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-2">
          {files.map(f => (
            <div key={f.id} className="flex items-center gap-2.5 py-2 px-3 bg-surface-2 border border-border rounded-md text-[12px]">
              <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                {getFileExt(f.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-foreground font-medium truncate" title={f.name}>{f.name}</div>
                <div className="text-text-muted text-[11px]">{formatSize(f.size)}</div>
              </div>
              <div className="flex gap-1">
                {f.data && (
                  <button className="px-2 py-1 bg-surface-3 text-foreground border border-border rounded text-[11px] font-semibold cursor-pointer hover:bg-surface-4"
                    onClick={() => downloadFile(f.data, f.name)}><Icons.dl size={12} /></button>
                )}
                {!disabled && onRemove && (
                  <button className="px-2 py-1 bg-destructive/10 text-destructive rounded text-[11px] font-semibold cursor-pointer hover:bg-destructive/20"
                    onClick={() => onRemove(f.id)}><Icons.x size={12} /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUpload;
