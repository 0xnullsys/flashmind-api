import React, { useState } from 'react';
import { t } from '../lib/id';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';

interface AuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthDialog({ isOpen, onClose }: AuthDialogProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const { login, register } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleUrl, setGoogleUrl] = useState('/api/auth/google');

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('male');

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

        <a href={googleUrl} className="auth-google">
          {t('auth.google')}
        </a>

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