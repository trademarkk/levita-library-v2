import { X } from 'lucide-react';
import { GlassCard } from './GlassCard';

type ConfirmChecklistDialogProps = {
  itemLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmChecklistDialog({ itemLabel, onCancel, onConfirm }: ConfirmChecklistDialogProps) {
  return (
    <div className="fixed inset-0 z-50 bg-[#0f0e12]/70 backdrop-blur-sm flex items-center justify-center p-4">
      <GlassCard className="w-full max-w-md">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h3 className="text-2xl text-[#f5f3f0]">Подтвердить выполнение?</h3>
            <p className="text-[#a89b8f] mt-3">Действительно пункт «{itemLabel}» выполнен?</p>
          </div>
          <button onClick={onCancel} className="text-[#a89b8f] hover:text-[#f5f3f0]" aria-label="Закрыть подтверждение">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-[#c9a98d]/20 text-[#f5f3f0] hover:bg-[#2a2630]">Отмена</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-[#c9a98d] text-[#0f0e12] hover:bg-[#d6b79d]">Да, выполнен</button>
        </div>
      </GlassCard>
    </div>
  );
}
