import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { SearchResult, TranslationCache } from '../types';
import { ExternalLink, Search, BookOpen, ShieldCheck, Globe } from 'lucide-react';
import { translateText } from '../services/geminiService';

interface SearchResultsProps {
  data: SearchResult | null;
  isLoading: boolean;
  query: string;
}

export const SearchResults: React.FC<SearchResultsProps> = ({ data, isLoading, query }) => {
  const [language, setLanguage] = useState<'English' | 'Hindi'>('English');
  const [translations, setTranslations] = useState<TranslationCache>({});
  const [isTranslating, setIsTranslating] = useState(false);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4 text-slate-500 dark:text-slate-400 animate-pulse">
        <Search className="w-12 h-12 text-slate-300 dark:text-slate-600" />
        <p className="text-lg">Searching the web for "{query}"...</p>
      </div>
    );
  }

  if (!data) return null;

  const handleLanguageChange = async (newLang: 'English' | 'Hindi') => {
    if (newLang === language) return;
    setLanguage(newLang);

    if (newLang === 'English') return;

    // Check cache
    const textKey = `${newLang}_text`;
    const verifyKey = `${newLang}_verify`;
    
    if (translations[textKey]) return;

    setIsTranslating(true);
    try {
      // Translate main text
      const translatedMain = await translateText(data.text, newLang);
      
      let translatedVerify = '';
      if (data.verification) {
        translatedVerify = await translateText(data.verification, newLang);
      }

      setTranslations(prev => ({
        ...prev,
        [textKey]: translatedMain,
        ...(translatedVerify ? { [verifyKey]: translatedVerify } : {})
      }));
    } catch (error) {
      console.error("Translation failed", error);
      setLanguage('English'); // Revert on error
    } finally {
      setIsTranslating(false);
    }
  };

  const currentText = language === 'English' ? data.text : (translations[`${language}_text`] || data.text);
  const currentVerification = language === 'English' ? data.verification : (translations[`${language}_verify`] || data.verification);

  return (
    <div className="w-full bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden relative transition-all duration-300">
      
      {/* Loading Overlay for Translation */}
      {isTranslating && (
        <div className="absolute inset-0 z-20 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm flex flex-col items-center justify-center transition-all">
            <Globe className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Translating results...</p>
        </div>
      )}

      <div className="p-6">
        <div className="flex flex-wrap items-center justify-between mb-6 border-b border-slate-100 dark:border-slate-700 pb-4 gap-4">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
            <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-semibold text-lg">Results</h3>
          </div>

          {/* Language Toggle */}
           <div className="flex items-center bg-slate-100 dark:bg-slate-700/50 rounded-lg p-1">
              <button
                  onClick={() => handleLanguageChange('English')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                      language === 'English' 
                      ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-300 shadow-sm ring-1 ring-slate-200 dark:ring-slate-500' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
              >
                  <span className="font-bold">EN</span> English
              </button>
              <button
                  onClick={() => handleLanguageChange('Hindi')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                      language === 'Hindi' 
                      ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-indigo-300 shadow-sm ring-1 ring-slate-200 dark:ring-slate-500' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
              >
                  <span className="font-bold">HI</span> हिन्दी
              </button>
           </div>
        </div>

        <div className="prose max-w-none prose-p:text-slate-600 dark:prose-p:text-slate-300 prose-headings:text-slate-800 dark:prose-headings:text-slate-100 prose-strong:text-slate-900 dark:prose-strong:text-white prose-li:text-slate-600 dark:prose-li:text-slate-300 prose-a:text-indigo-600 dark:prose-a:text-indigo-400 mb-8">
          <ReactMarkdown>{currentText}</ReactMarkdown>
        </div>
        
        {/* Verification Section */}
        {currentVerification && (
          <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-800">
            <div className="flex items-center gap-2 mb-2 text-emerald-800 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <h4 className="text-sm font-semibold uppercase tracking-wider">AI Verification</h4>
            </div>
            <p className="text-sm text-emerald-700 dark:text-emerald-300 leading-relaxed">
              {currentVerification}
            </p>
          </div>
        )}

        {data.webSources.length > 0 && (
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-100 dark:border-slate-700">
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Sources</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              {data.webSources.map((source, idx) => (
                <a 
                  key={idx}
                  href={source.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 p-2 rounded hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm transition-all group"
                >
                  <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 truncate">
                    {source.title}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};