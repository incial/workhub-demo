import React from 'react';
import { createPortal } from 'react-dom';

const MODAL_Z_INDEX_CLASS = 'z-[140]';
const MODAL_HEADER_HEIGHT_PX = 88;

interface StandardModuleModalProps {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    onClose: () => void;
    children: React.ReactNode;
    maxWidthClassName?: string;
}

export const StandardModuleModal: React.FC<StandardModuleModalProps> = ({
    title,
    subtitle,
    icon,
    onClose,
    children,
    maxWidthClassName = 'max-w-3xl'
}) => {
    React.useEffect(() => {
        const scrollY = window.scrollY;
        const previousOverflow = document.body.style.overflow;
        const previousPosition = document.body.style.position;
        const previousTop = document.body.style.top;
        const previousWidth = document.body.style.width;

        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';

        return () => {
            document.body.style.overflow = previousOverflow;
            document.body.style.position = previousPosition;
            document.body.style.top = previousTop;
            document.body.style.width = previousWidth;
            window.scrollTo(0, scrollY);
        };
    }, []);

    const content = (
        <div className={`fixed inset-0 ${MODAL_Z_INDEX_CLASS} flex items-center justify-center p-4 sm:p-6`}>
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden="true"
            />
            <div
                role="dialog"
                aria-modal="true"
                className={`relative glass-panel rounded-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl ${maxWidthClassName}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 bg-white/95 backdrop-blur-md px-6 py-5 border-b border-gray-200 rounded-t-2xl z-10">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            {icon && (
                                <div className="p-2 rounded-xl bg-brand-50 text-brand-600 shrink-0">
                                    {icon}
                                </div>
                            )}
                            <div className="min-w-0">
                                <h2 className="text-xl font-bold text-gray-900 truncate">{title}</h2>
                                {subtitle && <p className="text-sm text-gray-600 mt-0.5">{subtitle}</p>}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-700 text-2xl font-bold leading-none px-1"
                            aria-label="Close modal"
                        >
                            ×
                        </button>
                    </div>
                </div>
                <div className="overflow-y-auto overscroll-contain custom-scrollbar" style={{ maxHeight: `calc(90vh - ${MODAL_HEADER_HEIGHT_PX}px)` }}>
                    {children}
                </div>
            </div>
        </div>
    );

    return createPortal(content, document.body);
};
