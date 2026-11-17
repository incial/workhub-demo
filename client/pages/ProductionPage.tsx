import React, { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Save, PackagePlus, BarChart3, Search } from 'lucide-react';
import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { useLayout } from '../context/LayoutContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { productionApi } from '../services/api';
import { ProductionEntry, ProductionProduct } from '../types';
import { PRODUCTION_CATEGORY_OPTIONS } from '../constants/dropdown-options';
import { CustomSelect } from '../components/ui/CustomSelect';

const MONTH_OPTIONS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const YEAR_OPTIONS = Array.from({ length: 2100 - 2025 + 1 }, (_, index) => 2025 + index);

const getMonthLabel = (month?: number) => {
    if (!month || month < 1 || month > 12) return 'Unknown';
    return MONTH_OPTIONS[month - 1];
};

export const ProductionPage: React.FC = () => {
    const { isSidebarCollapsed, showSidebar } = useLayout();
    const { showToast } = useToast();
    const { user, isDemo } = useAuth();
    const hasProductionRole = isDemo || user?.role === 'ROLE_PRODUCTION' || user?.role === 'ROLE_ADMIN' || user?.role === 'ROLE_OPERATOR';

    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [products, setProducts] = useState<ProductionProduct[]>([]);
    const [entries, setEntries] = useState<ProductionEntry[]>([]);
    const [yearlyTrend, setYearlyTrend] = useState<{ month: number; totalQuantity: number }[]>([]);
    const [originalQuantities, setOriginalQuantities] = useState<Record<number, number>>({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [viewMode, setViewMode] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [customName, setCustomName] = useState('');
    const [customCategory, setCustomCategory] = useState<string>(PRODUCTION_CATEGORY_OPTIONS[0]);

    const loadData = async (selectedMonth: number, selectedYear: number) => {
        setLoading(true);
        try {
            const [productData, summary, trend] = await Promise.all([
                productionApi.getProducts(),
                productionApi.getMonthlySummary(selectedMonth, selectedYear),
                productionApi.getYearlyTrend(selectedYear)
            ]);
            setProducts(productData);
            const loadedEntries = summary.entries || [];
            setEntries(loadedEntries);
            setOriginalQuantities(
                loadedEntries.reduce<Record<number, number>>((acc, entry) => {
                    acc[entry.productId] = Math.max(0, entry.quantity || 0);
                    return acc;
                }, {})
            );
            setYearlyTrend(trend || []);
        } catch (error: any) {
            showToast(error.message || 'Failed to load production data', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData(month, year);
    }, [month, year]);

    const handleQuantityChange = (productId: number, nextValue: number) => {
        if (!hasProductionRole || viewMode) return;
        const safeValue = Math.max(0, nextValue);
        setEntries(prev => prev.map(entry => entry.productId === productId ? { ...entry, quantity: safeValue } : entry));
    };

    const handleSave = async () => {
        if (!hasProductionRole || viewMode) return;
        const changedQuantities = entries
            .filter((entry) => Math.max(0, entry.quantity || 0) !== (originalQuantities[entry.productId] ?? 0))
            .map((entry) => ({ productId: entry.productId, quantity: Math.max(0, entry.quantity || 0) }));
        if (changedQuantities.length === 0) {
            showToast('No product changes to save', 'success');
            return;
        }
        setSaving(true);
        try {
            const summary = await productionApi.saveMonthlySummary({
                month,
                year,
                quantities: changedQuantities
            });
            const savedEntries = summary.entries || [];
            setEntries(savedEntries);
            setOriginalQuantities(
                savedEntries.reduce<Record<number, number>>((acc, entry) => {
                    acc[entry.productId] = Math.max(0, entry.quantity || 0);
                    return acc;
                }, {})
            );
            showToast('Production quantities saved successfully', 'success');
        } catch (error: any) {
            showToast(error.message || 'Failed to save production data', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleCreateCustom = async () => {
        if (!hasProductionRole || viewMode) return;
        const name = customName.trim();
        const category = customCategory.trim();
        if (!name) {
            showToast('Product name is required', 'error');
            return;
        }
        if (!category) {
            showToast('Category is required', 'error');
            return;
        }
        try {
            await productionApi.createProduct({ name, category });
            setCustomName('');
            showToast('Custom product added', 'success');
            await loadData(month, year);
        } catch (error: any) {
            showToast(error.message || 'Failed to add custom product', 'error');
        }
    };

    const totalQuantity = useMemo(() => entries.reduce((sum, entry) => sum + (entry.quantity || 0), 0), [entries]);

    const categoryBreakdown = useMemo(() => {
        const map = new Map<string, number>();
        entries.forEach(entry => {
            map.set(entry.category, (map.get(entry.category) || 0) + (entry.quantity || 0));
        });
        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [entries]);

    const customCategoryOptions = useMemo(() => {
        const normalized = new Map<string, string>();
        PRODUCTION_CATEGORY_OPTIONS.forEach((category) => {
            normalized.set(category.toLowerCase(), category);
        });
        products.forEach((product) => {
            const category = (product.category || '').trim();
            if (!category) return;
            const key = category.toLowerCase();
            if (!normalized.has(key)) {
                normalized.set(key, category);
            }
        });
        return Array.from(normalized.values())
            .sort((a, b) => a.localeCompare(b))
            .map((category) => ({ label: category, value: category }));
    }, [products]);

    const visibleEntries = useMemo(
        () => {
            const normalizedSearch = searchTerm.trim().toLowerCase();
            return (viewMode ? entries.filter((entry) => (entry.quantity || 0) > 0) : entries)
                .filter((entry) => !normalizedSearch || (entry.productName || '').toLowerCase().includes(normalizedSearch));
        },
        [entries, searchTerm, viewMode]
    );

    useEffect(() => {
        if (!customCategoryOptions.some((option) => option.value === customCategory) && customCategoryOptions.length > 0) {
            setCustomCategory(customCategoryOptions[0].value);
        }
    }, [customCategory, customCategoryOptions]);

    return (
        <div className="flex min-h-screen mesh-bg relative">
            <div className="glass-canvas" />
            <Sidebar />
            <div className={`flex-1 flex flex-col min-w-0 transition-all duration-500 ease-in-out ${!showSidebar ? 'lg:ml-0' : isSidebarCollapsed ? 'lg:ml-28' : 'lg:ml-80'}`}>
                <Navbar />
                <div className="px-4 lg:px-12 py-6 lg:py-10 pb-32 space-y-6">
                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                        <div>
                            <h1 className="text-3xl lg:text-4xl font-black text-gray-900 display-text mb-2">Production Section</h1>
                            <p className="text-gray-600 text-sm lg:text-base font-medium">
                                Track monthly production with quantity controls, summaries, and trend visibility.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm">
                                {MONTH_OPTIONS.map((label, index) => {
                                    const value = index + 1;
                                    return (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    );
                                })}
                            </select>
                            <select
                                value={year}
                                onChange={(e) => setYear(Number(e.target.value))}
                                className="w-28 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
                            >
                                {YEAR_OPTIONS.map(optionYear => (
                                    <option key={optionYear} value={optionYear}>
                                        {optionYear}
                                    </option>
                                ))}
                            </select>
                            <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white/85 px-3 py-2 shadow-sm backdrop-blur-sm">
                                <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-600">View Mode</span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={viewMode}
                                    onClick={() => setViewMode((prev) => !prev)}
                                    className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-300 ${
                                        viewMode
                                            ? 'bg-[linear-gradient(135deg,#2563eb,#1d4ed8)] shadow-[0_10px_24px_-14px_rgba(37,99,235,0.9)]'
                                            : 'bg-slate-200'
                                    }`}
                                >
                                    <span
                                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                                            viewMode ? 'translate-x-8' : 'translate-x-1'
                                        }`}
                                    />
                                </button>
                            </div>
                            {hasProductionRole && (
                                <button
                                    onClick={handleSave}
                                    disabled={saving || loading || viewMode}
                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
                                >
                                    <Save size={15} />
                                    {saving ? 'Saving...' : 'Save'}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="glass-panel rounded-2xl p-4 shadow-lg">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search products by name..."
                                className="w-full rounded-xl border border-gray-200 bg-white/80 py-3 pl-11 pr-4 text-sm font-medium text-gray-700 outline-none transition-all focus:border-brand-300 focus:ring-2 focus:ring-brand-200"
                            />
                        </div>
                    </div>

                    {hasProductionRole && !viewMode && (
                        <div className="glass-panel rounded-2xl p-5 lg:p-6 shadow-lg">
                            <div className="flex items-center gap-2 mb-4">
                                <PackagePlus size={18} className="text-brand-600" />
                                <h2 className="text-lg font-bold text-gray-900">Add Custom Product</h2>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                                <input
                                    type="text"
                                    placeholder="Product name"
                                    value={customName}
                                    onChange={(e) => setCustomName(e.target.value)}
                                    className="px-3 py-2 border border-gray-300 rounded-lg"
                                />
                                <CustomSelect
                                    value={customCategory}
                                    onChange={setCustomCategory}
                                    options={customCategoryOptions}
                                    placeholder="Select Category"
                                    searchable
                                    className="lg:col-span-2"
                                />
                                <button
                                    onClick={handleCreateCustom}
                                    className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                                >
                                    <PackagePlus size={15} />
                                    Add Item
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="glass-panel rounded-2xl p-5 lg:p-6 shadow-lg">
                        <h2 className="text-lg font-bold text-gray-900 mb-4">Monthly Production Tracker</h2>
                        {loading ? (
                            <div className="text-gray-600">Loading...</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-gray-600 bg-gray-50">
                                            <th className="px-3 py-2 font-semibold">Category</th>
                                            <th className="px-3 py-2 font-semibold">Product</th>
                                            <th className="px-3 py-2 font-semibold">Quantity</th>
                                            {hasProductionRole && <th className="px-3 py-2 font-semibold">Adjust</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibleEntries.map(row => (
                                            <tr key={row.productId} className="border-t border-gray-100">
                                                <td className="px-3 py-2">{row.category}</td>
                                                <td className="px-3 py-2">{row.productName}</td>
                                                <td className="px-3 py-2 font-semibold">{row.quantity}</td>
                                                {hasProductionRole && (
                                                    <td className="px-3 py-2">
                                                        <div className="inline-flex items-center gap-2">
                                                            <button
                                                                onClick={() => handleQuantityChange(row.productId, (row.quantity || 0) - 1)}
                                                                disabled={viewMode}
                                                                className="p-1 rounded border border-gray-300 disabled:cursor-not-allowed disabled:opacity-40"
                                                            >
                                                                <Minus size={14} />
                                                            </button>
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                value={row.quantity}
                                                                onChange={(e) => handleQuantityChange(row.productId, Number(e.target.value) || 0)}
                                                                readOnly={viewMode}
                                                                className="w-20 px-2 py-1 border border-gray-300 rounded text-center read-only:cursor-default read-only:bg-slate-50"
                                                            />
                                                            <button
                                                                onClick={() => handleQuantityChange(row.productId, (row.quantity || 0) + 1)}
                                                                disabled={viewMode}
                                                                className="p-1 rounded border border-gray-300 disabled:cursor-not-allowed disabled:opacity-40"
                                                            >
                                                                <Plus size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                        {visibleEntries.length === 0 && (
                                            <tr>
                                                <td
                                                    colSpan={hasProductionRole ? 4 : 3}
                                                    className="px-3 py-10 text-center text-sm font-medium text-gray-500"
                                                >
                                                    {viewMode ? 'No active production items for this month yet.' : 'No production entries found.'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="glass-panel rounded-2xl p-5 lg:p-6 shadow-lg">
                            <h2 className="text-lg font-bold text-gray-900 mb-4">Production Summary</h2>
                            <div className="space-y-2 text-sm">
                                <div className="font-semibold">Total Quantity: {totalQuantity}</div>
                                {categoryBreakdown.map(([category, qty]) => (
                                    <div key={category} className="flex justify-between border-t border-gray-100 pt-2">
                                        <span>{category}</span>
                                        <span className="font-semibold">{qty}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="glass-panel rounded-2xl p-5 lg:p-6 shadow-lg">
                            <div className="flex items-center gap-2 mb-4">
                                <BarChart3 size={18} className="text-brand-600" />
                                <h2 className="text-lg font-bold text-gray-900">Yearly Trend ({year})</h2>
                            </div>
                            <div className="space-y-2 text-sm max-h-72 overflow-y-auto">
                                {yearlyTrend.map(item => (
                                    <div key={item.month} className="flex justify-between border-t border-gray-100 pt-2">
                                        <span>{getMonthLabel(item.month)}</span>
                                        <span className="font-semibold">{item.totalQuantity}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
