import React from 'react';

interface ConfirmProps {
  title?: string;
  msg: string;
  label?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const Confirm: React.FC<ConfirmProps> = ({ title = '¿Seguro?', msg, label = 'Confirmar', onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] backdrop-blur-[4px]" onClick={onCancel}>
    <div className="bg-card border border-border rounded-xl p-6 w-[400px] text-center fade-in" onClick={e => e.stopPropagation()}>
      <h3 className="text-[15px] text-foreground font-semibold mb-2">{title}</h3>
      <p className="text-[13px] text-text-secondary mb-5">{msg}</p>
      <div className="flex gap-2 justify-center">
        <button className="px-4 py-2 bg-surface-3 text-foreground border border-border rounded-md text-[12px] font-semibold cursor-pointer hover:bg-surface-4 transition-colors" onClick={onCancel}>Cancelar</button>
        <button className="px-4 py-2 bg-destructive/10 text-destructive rounded-md text-[12px] font-semibold cursor-pointer hover:bg-destructive/20 transition-colors" onClick={onConfirm}>{label}</button>
      </div>
    </div>
  </div>
);

export default Confirm;
