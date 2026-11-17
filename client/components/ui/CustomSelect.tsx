import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import { createPortal } from 'react-dom';

export interface Option {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  allowCustom?: boolean; 
  searchable?: boolean;
  clearable?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({ 
  label, 
  value, 
  onChange, 
  options, 
  placeholder = "Select...",
  className = "",
  required = false,
  disabled = false,
  allowCustom = false,
  searchable = false,
  clearable = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);
  const filteredOptions = searchable
    ? options.filter(opt => opt.label.toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width
      });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if clicking outside the main container
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        // Also check if the click is inside the portal menu
        const portal = document.getElementById('select-portal-menu');
        if (portal && portal.contains(event.target as Node)) {
            return;
        }
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      updateCoords();
      window.addEventListener('scroll', updateCoords, true);
      window.addEventListener('resize', updateCoords);
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (val: string) => {
      onChange(val);
      setSearchTerm('');
      setIsOpen(false);
  };

  const menuContent = isOpen && (
    <div 
      id="select-portal-menu"
      className="fixed bg-white/95 backdrop-blur-2xl border border-white/60 rounded-[1.5rem] shadow-2xl z-[9999] overflow-hidden animate-premium origin-top ring-1 ring-black/5"
      style={{ 
        top: coords.top, 
        left: coords.left, 
        width: coords.width,
        maxHeight: '260px'
      }}
    >
      <div className="max-h-64 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {searchable && (
            <div className="px-2 pb-2">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Type to filter..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
            </div>
        )}
        {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
            <button
                key={option.value}
                type="button"
                onClick={(e) => { 
                    e.preventDefault();
                    e.stopPropagation(); 
                    handleSelect(option.value); 
                }}
                className={`w-full flex items-center justify-between px-4 py-3 text-[11px] font-black uppercase tracking-widest rounded-xl text-left transition-all group ${
                option.value === value 
                    ? 'bg-indigo-600 text-white shadow-lg' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
                }`}
            >
                <div className="flex items-center gap-3 truncate">
                    {option.icon && (
                        <span className={`flex-shrink-0 ${option.value === value ? 'text-white' : 'text-slate-400 group-hover:text-indigo-600'}`}>
                            {option.icon}
                        </span>
                    )}
                    <span className="truncate">{option.label}</span>
                </div>
                {option.value === value && <Check className="h-3.5 w-3.5 text-white flex-shrink-0" />}
            </button>
            ))
        ) : (
            <div className="px-3 py-6 text-[10px] text-slate-400 text-center font-black uppercase tracking-[0.2em]">No Matching Options</div>
        )}
      </div>
    </div>
  );

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
          <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-[0.2em] ml-1">
              {label} {required && <span className="text-rose-500">*</span>}
          </label>
      )}
      
      <div
        ref={triggerRef}
        className={`w-full flex items-center justify-between px-5 py-4 bg-white border rounded-[1.5rem] text-sm transition-all duration-300 outline-none cursor-pointer group ${
          disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed border-gray-100' :
          isOpen 
            ? 'border-indigo-500 ring-4 ring-indigo-500/10 shadow-lg' 
            : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
        }`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3 truncate flex-1">
            {selectedOption?.icon && <span className="flex-shrink-0 text-indigo-600">{selectedOption.icon}</span>}
            
            {allowCustom ? (
                <input 
                    type="text"
                    className="w-full bg-transparent border-none p-0 focus:ring-0 text-slate-900 font-bold placeholder-slate-300"
                    placeholder={placeholder}
                    value={isOpen && !selectedOption ? value : (selectedOption ? selectedOption.label : value)} 
                    onChange={(e) => {
                        e.stopPropagation();
                        onChange(e.target.value);
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(true);
                    }} 
                    onFocus={() => setIsOpen(true)}
                    disabled={disabled}
                />
            ) : (
                <span className={`truncate font-bold ${!selectedOption ? 'text-slate-300' : 'text-slate-900'}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
            )}
        </div>
        <div className="flex items-center gap-2">
            {clearable && !!value && !disabled && (
                <button
                    type="button"
                    aria-label="Clear selection"
                    onClick={(e) => {
                        e.stopPropagation();
                        onChange('');
                        setSearchTerm('');
                    }}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            )}
            <ChevronDown 
                className={`h-4 w-4 text-slate-300 transition-transform duration-500 flex-shrink-0 group-hover:text-indigo-600 ${isOpen ? 'rotate-180 text-indigo-600' : ''}`} 
            />
        </div>
      </div>

      {isOpen && createPortal(menuContent, document.body)}
    </div>
  );
};
