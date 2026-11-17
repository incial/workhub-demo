import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface ProjectDeletionRequestModalProps {
    isOpen: boolean;
    projectName?: string;
    onClose: () => void;
    onSubmit: (reason: string) => Promise<void> | void;
}

export const ProjectDeletionRequestModal: React.FC<ProjectDeletionRequestModalProps> = ({
    isOpen,
    projectName,
    onClose,
    onSubmit
}) => {
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setReason('');
            setSubmitting(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = reason.trim();
        if (!trimmed || submitting) return;
        try {
            setSubmitting(true);
            await onSubmit(trimmed);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-[140] p-4" onClick={onClose}>
            <div className="glass-panel rounded-2xl p-6 w-full max-w-lg shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-white/60 transition-colors"
                    aria-label="Close modal"
                >
                    <X size={18} />
                </button>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Request Project Deletion</h2>
                <p className="text-sm text-gray-600 mb-5">
                    {projectName ? `Project: ${projectName}. ` : ''}This action freezes the project until admin approval.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Reason / Remark <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full min-h-[120px] px-4 py-3 bg-white/70 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm text-gray-800"
                            placeholder="Enter the reason for requesting deletion"
                            required
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-all disabled:opacity-60"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!reason.trim() || submitting}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-semibold hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {submitting ? 'Submitting...' : 'Submit Request'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
