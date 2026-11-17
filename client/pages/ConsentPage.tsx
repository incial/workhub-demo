import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { CURRENT_POLICY_VERSION, requiresPolicyConsent } from '../utils/policyConsent';

const TERMS_URL = '/terms-of-service';
const PRIVACY_URL = '/privacy-policy';

export const ConsentPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, updateUser } = useAuth();
  const { showToast } = useToast();
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!requiresPolicyConsent(user)) return <Navigate to="/" replace />;

  const handleContinue = async () => {
    if (!agreed || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await authApi.acceptPolicy({
        accepted: true,
        version: CURRENT_POLICY_VERSION
      });

      const responseUser = res?.user ?? res?.data?.user;
      if (responseUser) {
        updateUser(responseUser);
      } else {
        updateUser({
          termsAccepted: true,
          policyVersion: CURRENT_POLICY_VERSION
        });
      }

      navigate('/', { replace: true });
    } catch (error: any) {
      showToast(error?.message || 'Failed to save consent. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">Terms &amp; Privacy Agreement</h1>
        <p className="text-sm sm:text-base text-gray-600 mb-6">
          You must accept our Terms of Service and Privacy Policy to continue.
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <Link
            to={TERMS_URL}
            target="_blank"
            rel="noreferrer"
            className="text-blue-700 font-medium hover:underline"
          >
            Terms of Service
          </Link>
          <span className="hidden sm:inline text-gray-400">•</span>
          <Link
            to={PRIVACY_URL}
            target="_blank"
            rel="noreferrer"
            className="text-blue-700 font-medium hover:underline"
          >
            Privacy Policy
          </Link>
        </div>

        <label className="flex items-start gap-3 mb-8 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm sm:text-base text-gray-800">
            I agree to the Terms of Service and Privacy Policy
          </span>
        </label>

        <button
          type="button"
          onClick={handleContinue}
          disabled={!agreed || isSubmitting}
          className="w-full h-11 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Continue
        </button>
      </div>
    </div>
  );
};
