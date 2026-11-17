import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DEMO_EMAIL, DEMO_PASSWORD, hasDemoMarker } from '../demo/session';
import { ImageConfig } from '../constants/images';
import { Loader2, AlertCircle, Eye, EyeOff, Sparkles, HardDrive, Target, Briefcase, Wallet, Wrench, MessageSquareHeart, ArrowRight } from 'lucide-react';

const WORKFLOW = [
    { icon: Target, title: 'Leads & visits', text: 'Executives capture schools, schedule visits and record outcomes.' },
    { icon: Briefcase, title: 'Sales', text: 'Coordinators prepare quotations, invoices and delivery dates.' },
    { icon: Wallet, title: 'Accounts', text: 'Payments are recorded against invoices with full history.' },
    { icon: Wrench, title: 'Installation', text: 'Installation teams track task lists through to completion.' },
    { icon: MessageSquareHeart, title: 'Feedback', text: 'Completed projects flow into the feedback queue and reports.' },
];

export const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login, logout } = useAuth();

    useEffect(() => {
        // A malformed marker must be cleared through the same clean logout path.
        if (hasDemoMarker()) logout();
    }, [logout]);

    const signIn = async (loginEmail: string, loginPassword: string) => {
        setIsLoading(true);
        setError('');
        try {
            const response = await authApi.login(loginEmail, loginPassword);
            login(response.token, response.user);
        } catch (err: any) {
            setError(err?.message || 'Authentication failed');
            setIsLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        void signIn(email, password);
    };

    const useDemoAccount = () => {
        setEmail(DEMO_EMAIL);
        setPassword(DEMO_PASSWORD);
        void signIn(DEMO_EMAIL, DEMO_PASSWORD);
    };

    return (
        <div className="min-h-screen w-full flex font-sans bg-[#1a1a2e]">

            <div className="hidden lg:flex w-1/2 relative overflow-hidden flex-col justify-between p-10 bg-[#0f0f1a]">
                <div className="pointer-events-none absolute -top-40 -left-32 h-[480px] w-[480px] rounded-full bg-brand-600/30 blur-[120px]" />
                <div className="pointer-events-none absolute -bottom-40 right-0 h-[420px] w-[420px] rounded-full bg-indigo-500/20 blur-[120px]" />

                <div className="relative z-10 flex items-center gap-3 text-2xl font-bold tracking-tight text-white">
                    <img src={ImageConfig.logo} alt="WorkHub" className="h-10 w-10 rounded-xl shadow-lg object-contain" />
                    WorkHub
                </div>

                <div className="relative z-10 my-10">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-300">Education infrastructure CRM</p>
                    <h1 className="mt-3 text-[34px] font-semibold leading-[1.25] text-white">
                        One workspace from first<br />school visit to final feedback.
                    </h1>
                    <ol className="mt-10 space-y-5">
                        {WORKFLOW.map(({ icon: Icon, title, text }, index) => (
                            <li key={title} className="flex items-start gap-4">
                                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-brand-200">
                                    <Icon className="h-5 w-5" />
                                </span>
                                <div>
                                    <p className="text-sm font-bold text-white"><span className="text-gray-500 mr-2">{String(index + 1).padStart(2, '0')}</span>{title}</p>
                                    <p className="text-sm text-gray-400 mt-0.5">{text}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>

                <p className="relative z-10 flex items-center gap-2 text-xs text-gray-500">
                    <HardDrive className="h-4 w-4" /> Showcase build. Runs entirely in your browser with fictional data.
                </p>
            </div>

            <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16 relative overflow-y-auto bg-[#16162a]">
                <div className="w-full max-w-[400px] flex flex-col">
                    <div className="lg:hidden mb-10">
                        <div className="flex items-center gap-3 font-bold text-2xl tracking-tight text-white">
                            <img src={ImageConfig.logo} alt="WorkHub" className="h-10 w-10 rounded-xl shadow-lg object-contain" />
                            WorkHub
                        </div>
                    </div>

                    <div className="mb-8">
                        <h2 className="text-[32px] font-bold text-white tracking-tight">Welcome</h2>
                        <p className="text-gray-400 mt-2 text-sm">Sign in to explore the WorkHub demo workspace</p>
                    </div>

                    <div className="mb-6 rounded-2xl border border-brand-500/30 bg-brand-500/10 p-4">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brand-300">
                            <Sparkles className="h-4 w-4" /> Demo account
                        </div>
                        <dl className="mt-3 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
                            <dt className="text-gray-400">Email</dt><dd className="font-mono text-white">{DEMO_EMAIL}</dd>
                            <dt className="text-gray-400">Password</dt><dd className="font-mono text-white">{DEMO_PASSWORD}</dd>
                        </dl>
                        <button
                            type="button"
                            onClick={useDemoAccount}
                            disabled={isLoading}
                            className="mt-4 w-full h-11 bg-white text-[#16162a] font-bold text-sm rounded-[10px] transition-all flex items-center justify-center gap-2 hover:bg-gray-100 disabled:opacity-70 active:scale-[0.98]"
                        >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Enter demo workspace <ArrowRight className="h-4 w-4" /></>}
                        </button>
                    </div>

                    <div className="relative py-2 mb-4">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/10"></div>
                        </div>
                        <div className="relative flex justify-center text-[10px] uppercase tracking-[0.15em] font-bold">
                            <span className="bg-[#16162a] px-3 text-gray-500">Or sign in manually</span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-4 rounded-xl bg-red-500/10 text-red-400 text-sm font-medium border border-red-500/20 flex items-center gap-3" role="alert">
                                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label htmlFor="login-email" className="block text-xs font-bold text-gray-400 ml-1 uppercase tracking-wide">Email</label>
                            <input
                                id="login-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                                className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-[10px] text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all font-medium"
                                placeholder={DEMO_EMAIL}
                                autoComplete="username"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="login-password" className="block text-xs font-bold text-gray-400 ml-1 uppercase tracking-wide">Password</label>
                            <div className="relative">
                                <input
                                    id="login-password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full h-12 pl-4 pr-12 bg-white/5 border border-white/10 rounded-[10px] text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all font-medium"
                                    placeholder="Enter your password"
                                    autoComplete="current-password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors p-1"
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-end pt-1">
                            <Link to="/forgot-password" className="text-xs font-bold uppercase tracking-[0.12em] text-brand-400 hover:underline">
                                Forgot Password
                            </Link>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-12 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-[10px] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98] mt-2"
                        >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign In'}
                        </button>
                    </form>

                    <p className="text-center text-xs text-gray-500 mt-8 font-medium leading-relaxed">
                        All data is fictional and saved only in this browser.<br />Use <span className="text-gray-300">Reset demo data</span> in the profile menu to start over.
                    </p>
                </div>
            </div>
        </div>
    );
};
