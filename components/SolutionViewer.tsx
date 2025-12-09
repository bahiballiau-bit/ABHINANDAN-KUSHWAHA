import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { SolutionData, TranslationCache } from '../types';
import { Play, FileText, Sparkles, CheckCircle2, Globe } from 'lucide-react';
import { Button } from './Button';
import { translateText } from '../services/geminiService';

interface SolutionViewerProps {
  data: SolutionData;
  onGenerateVideo: () => void;
  videoStatus: 'idle' | 'generating' | 'completed' | 'error';
  videoUri?: string;
}

export const SolutionViewer: React.FC<SolutionViewerProps> = ({ 
  data, 
  onGenerateVideo, 
  videoStatus,
  videoUri
}) => {
  const [language, setLanguage] = useState<'English' | 'Hindi'>('English');
  const [translations, setTranslations] = useState<TranslationCache>({});
  const [isTranslating, setIsTranslating] = useState(false);

  const handleLanguageChange = async (newLang: 'English' | 'Hindi') => {
    if (newLang === language) return;
    
    setLanguage(newLang);
    
    // If we're switching back to English (assuming it's original) or have it cached, no need to fetch
    if (newLang === 'English') {
        return;
    }

    if (translations[newLang]) {
        return;
    }

    setIsTranslating(true);
    try {
        const translated = await translateText(data.solutionMarkdown, newLang);
        setTranslations(prev => ({
            ...prev,
            [newLang]: translated
        }));
    } catch (error) {
        console.error("Failed to translate", error);
        // Revert to English on error
        setLanguage('English');
    } finally {
        setIsTranslating(false);
    }
  };

  const contentToDisplay = language === 'English' 
    ? data.solutionMarkdown 
    : (translations[language] || data.solutionMarkdown);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-100 dark:border-slate-700 overflow-hidden ring-1 ring-slate-100 dark:ring-slate-700">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
             <FileText className="text-indigo-300 w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-white tracking-wide">Detailed Solution</h2>
        </div>

        <div className="flex items-center gap-4 self-end sm:self-auto">
             {/* Language Selector */}
             <div className="flex items-center bg-slate-800 dark:bg-slate-900/50 rounded-lg p-1 border border-slate-700/50">
                <button
                    onClick={() => handleLanguageChange('English')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                        language === 'English' 
                        ? 'bg-indigo-600 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                    }`}
                >
                    <span className="font-bold">EN</span> English
                </button>
                <button
                    onClick={() => handleLanguageChange('Hindi')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                        language === 'Hindi' 
                        ? 'bg-indigo-600 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                    }`}
                >
                    <span className="font-bold">HI</span> हिन्दी
                </button>
             </div>

            <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
            data.confidence === 'High' ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30' : 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30'
            }`}>
            <CheckCircle2 className="w-3 h-3" />
            {data.confidence} Confidence
            </div>
        </div>
      </div>

      <div className="p-6 md:p-8 grid lg:grid-cols-2 gap-10">
        
        {/* Left Column: Solution Text */}
        <div className="space-y-4 relative min-h-[300px]">
          {isTranslating ? (
              <div className="absolute inset-0 z-10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl">
                  <Globe className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Translating to Hindi...</p>
              </div>
          ) : null}
          
          <div className="prose prose-lg max-w-none prose-p:text-red-600 dark:prose-p:text-red-400 prose-headings:text-red-700 dark:prose-headings:text-red-500 prose-strong:text-red-800 dark:prose-strong:text-red-300 prose-li:text-red-600 dark:prose-li:text-red-400 prose-ol:text-red-600 dark:prose-ol:text-red-400 prose-ul:text-red-600 dark:prose-ul:text-red-400 prose-pre:bg-slate-900 prose-pre:shadow-inner prose-pre:border prose-pre:border-slate-800 dark:prose-pre:border-slate-700">
            <ReactMarkdown>{contentToDisplay}</ReactMarkdown>
          </div>
        </div>

        {/* Right Column: Visualization */}
        <div className="space-y-6">
          <div className="bg-gradient-to-b from-indigo-50/50 to-white dark:from-slate-700/50 dark:to-slate-800 rounded-2xl p-6 border border-indigo-100/50 dark:border-slate-600/50 shadow-sm sticky top-24">
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-indigo-100 dark:border-slate-600">
              <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-md">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200">Visual Intelligence</h3>
            </div>
            
            <p className="text-sm text-slate-600 dark:text-slate-300 italic mb-6 bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
              "AI suggests visualizing: <br/> <span className="text-indigo-600 dark:text-indigo-400 not-italic font-medium">{data.visualPrompt}</span>"
            </p>

            {videoStatus === 'idle' && (
              <div className="text-center py-6">
                <Button 
                  onClick={onGenerateVideo} 
                  variant="secondary"
                  className="w-full shadow-emerald-500/20"
                  icon={<Play className="w-4 h-4 fill-current" />}
                >
                  Generate 3D Concept Video
                </Button>
                <p className="mt-4 text-xs text-slate-400 font-medium">
                  Powered by Google Veo Model
                </p>
              </div>
            )}

            {videoStatus === 'generating' && (
              <div className="flex flex-col items-center justify-center py-10 space-y-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-700 shadow-inner">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 border-4 border-slate-100 dark:border-slate-800 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-purple-600 rounded-full border-t-transparent animate-spin"></div>
                </div>
                <div className="text-center">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300 animate-pulse mb-1">
                    Rendering Simulation...
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500">Creating physics assets</p>
                </div>
              </div>
            )}

            {videoStatus === 'completed' && videoUri && (
              <div className="rounded-xl overflow-hidden shadow-2xl shadow-indigo-500/20 bg-black ring-4 ring-white dark:ring-slate-600">
                <video 
                  src={videoUri} 
                  controls 
                  autoPlay 
                  loop
                  className="w-full aspect-video object-contain"
                />
                <div className="p-3 bg-gradient-to-r from-slate-900 to-slate-800 text-center flex justify-between items-center px-4">
                  <span className="text-xs font-bold text-white tracking-wider">DOLPHIN AI</span>
                  <span className="text-[10px] text-slate-400 uppercase border border-slate-600 px-2 py-0.5 rounded">Veo Gen</span>
                </div>
              </div>
            )}

            {videoStatus === 'error' && (
              <div className="p-6 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm text-center border border-red-100 dark:border-red-800">
                <p className="font-semibold mb-2">Generation Failed</p>
                <p className="text-xs text-red-600/80 dark:text-red-400/80 mb-4 max-w-[220px] mx-auto leading-relaxed">
                  Please check your API quota or network connection and try again.
                </p>
                <Button onClick={onGenerateVideo} variant="outline" size="sm" className="bg-white dark:bg-slate-800 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:border-red-300">
                  Retry Generation
                </Button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};