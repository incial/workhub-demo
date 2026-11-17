import React from 'react';

export interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange }) => {
  return (
    <div className="liquid-tabs-shell animate-premium mb-6 rounded-[1.75rem] p-2 sm:p-2.5">
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5 sm:gap-2.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              liquid-tab-button group relative min-w-[7.25rem] flex-1 rounded-[1.2rem] px-2.5 py-2.5 text-[11px] font-semibold leading-tight sm:min-w-0 sm:px-4 sm:py-3 sm:text-sm
              ${activeTab === tab.id
                ? 'liquid-tab-button-active text-white shadow-[0_18px_38px_-24px_rgba(15,23,42,0.45)]'
                : 'text-slate-700 hover:text-slate-900'
              }
            `}
          >
            <span className="block truncate sm:whitespace-nowrap">{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`mt-1 inline-flex max-w-full items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold sm:ml-2 sm:mt-0 sm:px-2.5 sm:text-xs ${
                activeTab === tab.id
                  ? 'bg-white/18 text-white border border-white/20 shadow-sm'
                  : 'bg-white/65 text-slate-600 border border-white/70'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
