import React from 'react';
import { useTranslation } from '../i18n';
import type { Language } from '../types/settings';

export const UkFlag: React.FC<{ className?: string }> = ({ className = 'lang-flag-svg' }) => (
  <svg
    className={className}
    viewBox="0 0 60 30"
    width="18"
    height="12"
    aria-hidden="true"
    focusable="false"
  >
    <rect width="60" height="30" fill="#012169" />
    <path d="M0,0 L60,30 M60,0 L0,30" stroke="#ffffff" strokeWidth="6" />
    <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="2" />
    <path d="M30,0 v30 M0,15 h60" stroke="#ffffff" strokeWidth="10" />
    <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
  </svg>
);

export const JapanFlag: React.FC<{ className?: string }> = ({ className = 'lang-flag-svg' }) => (
  <svg
    className={className}
    viewBox="0 0 30 20"
    width="18"
    height="12"
    aria-hidden="true"
    focusable="false"
  >
    <rect width="30" height="20" fill="#ffffff" />
    <circle cx="15" cy="10" r="6" fill="#BC002D" />
  </svg>
);

interface LanguageToggleProps {
  className?: string;
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({ className = '' }) => {
  const { language, setLanguage } = useTranslation();

  const handleSelect = (lang: Language) => {
    if (lang !== language) {
      setLanguage(lang);
    }
  };

  return (
    <div
      className={`language-toggle-container ${className}`}
      role="radiogroup"
      aria-label="Language selection"
    >
      <button
        type="button"
        role="radio"
        aria-checked={language === 'en'}
        className={`lang-option-btn ${language === 'en' ? 'active' : ''}`}
        onClick={() => handleSelect('en')}
      >
        <UkFlag />
        <span className="lang-text">English</span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={language === 'ja'}
        className={`lang-option-btn ${language === 'ja' ? 'active' : ''}`}
        onClick={() => handleSelect('ja')}
      >
        <JapanFlag />
        <span className="lang-text">日本語</span>
      </button>
    </div>
  );
};

