import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../lib/id';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';

interface AuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  // ponytail: default redirects to /app after successful auth; caller can override
  onSuccess?: () => void;
}

export default function AuthDialog({ isOpen, onClose, onSuccess }: AuthDialogProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const { login, register } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('male');

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/auth/config', { credentials: 'include' })
      .then((r) => r.json())
      .then((d: { googleEnabled?: boolean }) => setGoogleEnabled(Boolean(d.googleEnabled)))
      .catch(() => setGoogleEnabled(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        if (!email || !password) {
          setError(t('error.required'));
          setLoading(false);
          return;
        }
        await login(email, password);
        onClose();
        (onSuccess ?? (() => navigate('/app')))();
      } else {
        if (!firstName || !lastName || !email || !password) {
          setError(t('error.required'));
          setLoading(false);
          return;
        }
        if (password.length < 8) {
          setError(t('error.passwordShort'));
          setLoading(false);
          return;
        }
        if (password !== passwordConfirm) {
          setError(t('error.passwordMismatch'));
          setLoading(false);
          return;
        }
        await register({ firstName, lastName, email, gender, password });
        onClose();
        (onSuccess ?? (() => navigate('/app')))();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t('error.network'));
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-dialog" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close" onClick={onClose}>
          ×
        </button>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => setMode('login')}
          >
            {t('auth.toggleLogin')}
          </button>
          <button
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => setMode('register')}
          >
            {t('auth.toggleRegister')}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}

          {mode === 'register' && (
            <>
              <div className="auth-row">
                <div className="auth-field">
                  <label>{t('auth.firstName')}</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder={t('auth.firstName')}
                  />
                </div>
                <div className="auth-field">
                  <label>{t('auth.lastName')}</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder={t('auth.lastName')}
                  />
                </div>
              </div>

              <div className="auth-field">
                <label>{t('auth.gender')}</label>
                <select value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="male">{t('auth.genderMale')}</option>
                  <option value="female">{t('auth.genderFemale')}</option>
                  <option value="other">{t('auth.genderOther')}</option>
                </select>
              </div>
            </>
          )}

          <div className="auth-field">
            <label>{t('auth.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.email')}
            />
          </div>

          <div className="auth-field">
            <label>{t('auth.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.password')}
            />
          </div>

          {mode === 'register' && (
            <div className="auth-field">
              <label>{t('auth.passwordConfirm')}</label>
              <input
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder={t('auth.passwordConfirm')}
              />
            </div>
          )}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? t('ai.loading') : mode === 'login' ? t('auth.submitLogin') : t('auth.submitRegister')}
          </button>
        </form>

        <div className="auth-divider">
          <span>atau</span>
        </div>

        {googleEnabled ? (
          <a href="/api/auth/google" className="auth-google">
            <svg className="auth-google-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {t('auth.google')}
          </a>
        ) : (
          <button type="button" className="auth-google auth-google--disabled" disabled>
            {t('auth.googleUnavailable')}
          </button>
        )}

        <div className="auth-switch">
          {mode === 'login' ? (
            <span>
              Belum punya akun?{' '}
              <button onClick={switchMode}>{t('auth.toggleRegister')}</button>
            </span>
          ) : (
            <span>
              Sudah punya akun?{' '}
              <button onClick={switchMode}>{t('auth.toggleLogin')}</button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}