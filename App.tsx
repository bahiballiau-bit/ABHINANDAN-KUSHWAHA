import React, { useState, useEffect } from 'react';
import { FileUploader } from './components/FileUploader';
import { SolutionViewer } from './components/SolutionViewer';
import { Button } from './components/Button';
import { ImageCropper } from './components/ImageCropper';
import { SearchResults } from './components/SearchResults';
import { solveProblem, generateExplanationVideo, performSearch } from './services/geminiService';
import { AppStatus, SolutionData, SearchResult } from './types';
import { Calculator, AlertTriangle, Search, X, Atom, Microscope, Clock, Trash2, FlaskConical, Moon, Sun } from 'lucide-react';

const DolphinLogo = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M21.95 10.5C21.45 8 19.45 6 16.95 5.5C14.45 5 11.95 6 10.45 8C9.45 9.3 8.95 11 8.95 12.5C8.95 13.5 9.45 14.5 10.45 15C11.45 15.5 12.45 15.5 13.45 15C13.95 14.8 14.45 14.5 14.95 14C14.45 15 13.45 16 12.45 16.5C10.95 17.2 9.45 17 7.95 16C7.45 15.7 6.95 15.2 6.45 14.5C5.95 13.8 5.45 13 4.95 12C4.45 11 4.45 10 4.95 9C5.45 8 6.45 7.5 7.45 7C8.45 6.5 9.45 6.5 10.45 7C10.95 7.2 11.45 7.5 11.95 8C11.45 6.5 10.45 5.5 8.95 5C7.95 4.5 6.45 4.5 4.95 5.5C3.45 6.5 2.45 8 1.95 9.5C1.45 11 1.45 12.5 1.95 14C2.45 15.5 3.45 16.5 4.95 17.5C6.45 18.5 7.95 19 9.45 19C11.95 19 14.45 18 15.95 16.5C17.45 15 18.45 13 18.95 11C19.45 10.5 20.95 10.5 21.95 10.5Z" />
    <circle cx="15.5" cy="8.5" r="1.2" fill="white" fillOpacity="0.6"/>
  </svg>
);

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [file, setFile] = useState<File | null>(null);
  const [solution, setSolution] = useState<SolutionData | null>(null);
  const [videoStatus, setVideoStatus] = useState<'idle' | 'generating' | 'completed' | 'error'>('idle');
  const [videoUri, setVideoUri] = useState<string | undefined>(undefined);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [apiKeySelected, setApiKeySelected] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Cropping State
  const [croppingSrc, setCroppingSrc] = useState<string | null>(null);

  // Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // Check for API key on mount
  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setApiKeySelected(hasKey);
      }
    };
    checkKey();
  }, []);

  // Initialize theme from local storage or system preference
  useEffect(() => {
    const isDark = localStorage.getItem('color-theme') === 'dark' || 
      (!('color-theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    setIsDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('color-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('color-theme', 'light');
    }
  };

  // Load search history from local storage
  useEffect(() => {
    const savedHistory = localStorage.getItem('dolphin_search_history');
    if (savedHistory) {
      try {
        setSearchHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse search history");
      }
    }
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      // Assume success after interaction
      setApiKeySelected(true);
      
      // If we failed before due to missing key, clear error
      if (errorMsg.includes("API Key")) {
        setErrorMsg('');
      }
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    if (selectedFile.type.startsWith('image/')) {
        // Prepare image for cropping
        const reader = new FileReader();
        reader.onload = () => {
            setCroppingSrc(reader.result as string);
        };
        reader.readAsDataURL(selectedFile);
    } else {
        // Directly set PDF/Docs
        setFile(selectedFile);
    }
  };

  const handleCropComplete = (croppedFile: File) => {
    setFile(croppedFile);
    setCroppingSrc(null);
  };

  const handleCropCancel = () => {
    setCroppingSrc(null);
    // Note: We don't clear 'file' here so previous state remains if they cancel new upload
  };

  const handleAnalyze = async () => {
    if (!file) return;
    if (!apiKeySelected) {
      await handleSelectKey();
    }

    setStatus(AppStatus.ANALYZING);
    setErrorMsg('');
    setSolution(null);
    setVideoStatus('idle');
    setVideoUri(undefined);

    try {
      const result = await solveProblem(file);
      setSolution(result);
      setStatus(AppStatus.SOLVED);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "Failed to analyze image. Please try again.");
      setStatus(AppStatus.ERROR);
      
      // If error is related to key/auth, prompt re-selection
      if (e.message?.includes("403") || e.message?.includes("API Key") || e.message?.includes("not found")) {
        setApiKeySelected(false);
      }
    }
  };

  const handleGenerateVideo = async () => {
    if (!solution?.visualPrompt) return;
    if (!apiKeySelected) {
      await handleSelectKey();
    }

    setVideoStatus('generating');
    try {
      const uri = await generateExplanationVideo(solution.visualPrompt);
      setVideoUri(uri);
      setVideoStatus('completed');
    } catch (e: any) {
      console.error("Video generation error:", e);
      
      // Robust check for 404 / Entity Not Found error (common with missing Veo access)
      const errorString = JSON.stringify(e);
      const errorMessage = e.message || (e.error?.message) || "";
      
      if (errorMessage.includes("Requested entity was not found") || errorString.includes("Requested entity was not found") || errorString.includes("404")) {
         setApiKeySelected(false);
         await handleSelectKey();
         
         // Auto-retry once after key selection
         try {
             setVideoStatus('generating'); 
             const uri = await generateExplanationVideo(solution.visualPrompt);
             setVideoUri(uri);
             setVideoStatus('completed');
             return; 
         } catch (retryError) {
             console.error("Retry failed:", retryError);
         }
      }
      
      setVideoStatus('error');
    }
  };

  const addToHistory = (query: string) => {
    const cleanQuery = query.trim();
    if (!cleanQuery) return;
    
    setSearchHistory(prev => {
      // Add new query to top, remove duplicates, keep max 5
      const newHistory = [cleanQuery, ...prev.filter(q => q !== cleanQuery)].slice(0, 5);
      localStorage.setItem('dolphin_search_history', JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('dolphin_search_history');
  };

  const handleSearchSuggestionClick = (topic: string) => {
    setSearchQuery(topic); 
    setSearchResult(null);
    setIsSearchOpen(true);
  };

  const executeSearch = async (e?: React.FormEvent, queryOverride?: string) => {
    e?.preventDefault();
    const queryToUse = queryOverride || searchQuery;

    if (!queryToUse.trim()) return;

    if (!apiKeySelected) {
      await handleSelectKey();
    }

    // Update the input field if we used an override (like clicking history)
    if (queryOverride) {
      setSearchQuery(queryOverride);
    }

    addToHistory(queryToUse);
    setIsSearching(true);
    setSearchResult(null);
    
    try {
      const result = await performSearch(queryToUse);
      setSearchResult(result);
    } catch (e: any) {
      console.error(e);
      setErrorMsg("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleReset = () => {
    setStatus(AppStatus.IDLE);
    setFile(null);
    setSolution(null);
    setVideoStatus('idle');
    setVideoUri(undefined);
    setErrorMsg('');
    setCroppingSrc(null);
  };

  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearchResult(null);
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen flex flex-col relative bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 transition-colors duration-300 selection:bg-indigo-100 selection:text-indigo-900 dark:selection:bg-indigo-900 dark:selection:text-indigo-100">
      {/* Crop Modal */}
      {croppingSrc && (
        <ImageCropper 
          imageSrc={croppingSrc} 
          onComplete={handleCropComplete} 
          onCancel={handleCropCancel} 
        />
      )}

      {/* Search Overlay */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white/90 dark:bg-slate-900/95 backdrop-blur-xl transition-all duration-300">
          <div className="max-w-4xl mx-auto w-full p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-8 pt-2">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Search className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                <span className="bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">Knowledge Engine</span>
              </h2>
              <button onClick={closeSearch} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-500 dark:text-slate-400" />
              </button>
            </div>

            <form onSubmit={(e) => executeSearch(e)} className="mb-4 relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl opacity-20 dark:opacity-30 group-focus-within:opacity-30 dark:group-focus-within:opacity-40 blur transition-opacity"></div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ask about math, physics, or science..."
                className="w-full text-lg px-6 py-5 rounded-2xl border-2 border-white dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 dark:text-slate-100 backdrop-blur-sm focus:border-indigo-500/50 dark:focus:border-indigo-400/50 outline-none shadow-xl shadow-indigo-500/10 transition-all pr-12 relative z-10 placeholder-slate-400 dark:placeholder-slate-500"
                autoFocus
              />
              <button 
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl hover:shadow-lg hover:shadow-indigo-500/30 disabled:opacity-50 transition-all z-20"
              >
                {isSearching ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Search className="w-5 h-5" />
                )}
              </button>
            </form>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {searchResult ? (
                <SearchResults data={searchResult} isLoading={isSearching} query={searchQuery} />
              ) : (
                <div className="space-y-8 mt-6">
                  {/* Recent History Section */}
                  {searchHistory.length > 0 && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          Recent
                        </h3>
                        <button 
                          onClick={clearHistory}
                          className="text-xs text-slate-400 hover:text-red-500 dark:hover:text-red-400 flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          Clear
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {searchHistory.map((historyItem, idx) => (
                          <button
                            key={idx}
                            onClick={() => executeSearch(undefined, historyItem)}
                            className="px-4 py-2 bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-600 dark:text-slate-300 rounded-full text-sm transition-all flex items-center gap-2 group"
                          >
                            <span>{historyItem}</span>
                            <Search className="w-3 h-3 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity -ml-2 group-hover:ml-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggestions Section inside Overlay */}
                  <div className="mt-8">
                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">
                      Trending Topics
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <button onClick={() => executeSearch(undefined, "Latest discoveries in quantum physics")} className="text-left p-5 rounded-2xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/10 transition-all group">
                          <span className="font-medium text-slate-700 dark:text-slate-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">Quantum Physics News</span>
                          <div className="h-1 w-8 bg-indigo-500/20 dark:bg-indigo-400/20 rounded-full mt-2 group-hover:w-full group-hover:bg-indigo-500 dark:group-hover:bg-indigo-400 transition-all duration-500"></div>
                       </button>
                       <button onClick={() => executeSearch(undefined, "Hardest unsolved math problems")} className="text-left p-5 rounded-2xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/10 transition-all group">
                          <span className="font-medium text-slate-700 dark:text-slate-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">Unsolved Math Problems</span>
                          <div className="h-1 w-8 bg-indigo-500/20 dark:bg-indigo-400/20 rounded-full mt-2 group-hover:w-full group-hover:bg-indigo-500 dark:group-hover:bg-indigo-400 transition-all duration-500"></div>
                       </button>
                       <button onClick={() => executeSearch(undefined, "Applications of calculus in engineering")} className="text-left p-5 rounded-2xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/10 transition-all group">
                          <span className="font-medium text-slate-700 dark:text-slate-200 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">Calculus in Engineering</span>
                          <div className="h-1 w-8 bg-indigo-500/20 dark:bg-indigo-400/20 rounded-full mt-2 group-hover:w-full group-hover:bg-indigo-500 dark:group-hover:bg-indigo-400 transition-all duration-500"></div>
                       </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      <header className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl sticky top-0 z-40 border-b border-white/20 dark:border-slate-800/50 shadow-sm transition-colors duration-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20 transform rotate-12 hover:rotate-0 transition-transform duration-300">
               <DolphinLogo className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-700 via-violet-600 to-emerald-500 dark:from-indigo-400 dark:via-violet-400 dark:to-emerald-400 bg-clip-text text-transparent">
              Dolphin
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button 
                onClick={toggleTheme}
                className="p-2.5 text-slate-500 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-full transition-all duration-300"
                title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>
            <button 
                onClick={() => setIsSearchOpen(true)}
                className="p-2.5 text-slate-500 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-full transition-all duration-300 transform hover:scale-105"
                title="Search Knowledge Engine"
            >
                <Search className="w-5 h-5" />
            </button>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>
            {!apiKeySelected && (
              <Button onClick={handleSelectKey} variant="outline" size="sm" className="hidden sm:flex dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300">
                Connect API Key
              </Button>
            )}
            <div className="flex gap-1.5 pl-2">
               <span className="w-3 h-3 rounded-full bg-rose-400 shadow-sm"></span>
               <span className="w-3 h-3 rounded-full bg-amber-400 shadow-sm"></span>
               <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-sm"></span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 space-y-10">
        
        {/* Status Error Message */}
        {errorMsg && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-700 dark:text-red-400 animate-in fade-in slide-in-from-top-2 shadow-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p>{errorMsg}</p>
          </div>
        )}

        {status === AppStatus.IDLE && (
          <div className="space-y-16 animate-in fade-in duration-700">
            {/* Hero Section */}
            <div className="text-center space-y-8 max-w-4xl mx-auto mt-8">
              <h2 className="text-5xl md:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
                Master STEM with <br/>
                <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 dark:from-indigo-400 dark:via-violet-400 dark:to-fuchsia-400 bg-clip-text text-transparent">Visual Intelligence</span>
              </h2>
              <p className="text-xl text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mx-auto">
                Snap a photo of your math or physics homework. Get detailed solutions and watch concepts come to life with AI-generated videos.
              </p>
            </div>

            {/* Quick Actions / Suggestions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
              <button 
                onClick={() => handleSearchSuggestionClick("Explain advanced calculus concepts")} 
                className="group p-6 bg-gradient-to-br from-indigo-50/50 to-white dark:from-slate-800 dark:to-slate-800/50 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 hover:border-indigo-400 dark:hover:border-indigo-500 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 transition-all text-left relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-2xl -mr-10 -mt-10 transition-all group-hover:bg-indigo-500/10 dark:group-hover:bg-indigo-500/20"></div>
                <div className="w-12 h-12 bg-white dark:bg-slate-700 rounded-xl shadow-md border border-indigo-50 dark:border-indigo-900 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                  <Calculator className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">Search Math</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Complex formulas & theorems</p>
              </button>
              
              <button 
                onClick={() => handleSearchSuggestionClick("Physics laws and simulation examples")} 
                className="group p-6 bg-gradient-to-br from-emerald-50/50 to-white dark:from-slate-800 dark:to-slate-800/50 rounded-2xl border border-emerald-100 dark:border-emerald-900/50 hover:border-emerald-400 dark:hover:border-emerald-500 shadow-sm hover:shadow-xl hover:shadow-emerald-500/10 transition-all text-left relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10 transition-all group-hover:bg-emerald-500/10 dark:group-hover:bg-emerald-500/20"></div>
                <div className="w-12 h-12 bg-white dark:bg-slate-700 rounded-xl shadow-md border border-emerald-50 dark:border-emerald-900 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                  <Atom className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">Search Physics</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Visualize forces & motion</p>
              </button>

              <button 
                onClick={() => handleSearchSuggestionClick("Chemical reactions and periodic table")} 
                className="group p-6 bg-gradient-to-br from-rose-50/50 to-white dark:from-slate-800 dark:to-slate-800/50 rounded-2xl border border-rose-100 dark:border-rose-900/50 hover:border-rose-400 dark:hover:border-rose-500 shadow-sm hover:shadow-xl hover:shadow-rose-500/10 transition-all text-left relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 dark:bg-rose-500/10 rounded-full blur-2xl -mr-10 -mt-10 transition-all group-hover:bg-rose-500/10 dark:group-hover:bg-rose-500/20"></div>
                <div className="w-12 h-12 bg-white dark:bg-slate-700 rounded-xl shadow-md border border-rose-50 dark:border-rose-900 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                  <FlaskConical className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                </div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1 group-hover:text-rose-700 dark:group-hover:text-rose-400 transition-colors">Search Chemistry</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Reactions & elements</p>
              </button>

              <button 
                onClick={() => handleSearchSuggestionClick("Latest scientific breakthroughs")} 
                className="group p-6 bg-gradient-to-br from-amber-50/50 to-white dark:from-slate-800 dark:to-slate-800/50 rounded-2xl border border-amber-100 dark:border-amber-900/50 hover:border-amber-400 dark:hover:border-amber-500 shadow-sm hover:shadow-xl hover:shadow-amber-500/10 transition-all text-left relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 dark:bg-amber-500/10 rounded-full blur-2xl -mr-10 -mt-10 transition-all group-hover:bg-amber-500/10 dark:group-hover:bg-amber-500/20"></div>
                <div className="w-12 h-12 bg-white dark:bg-slate-700 rounded-xl shadow-md border border-amber-50 dark:border-amber-900 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                  <Microscope className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-1 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">Search Science</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Discover new phenomena</p>
              </button>
            </div>

            {/* Upload Area */}
            <div className="max-w-3xl mx-auto">
              <FileUploader 
                onFileSelect={handleFileSelect} 
                selectedFile={file} 
              />
              <div className="mt-8 flex justify-center">
                <Button 
                  onClick={handleAnalyze} 
                  disabled={!file}
                  className="w-full sm:w-auto min-w-[220px] py-3 text-lg"
                  icon={<DolphinLogo className="w-5 h-5" />}
                >
                  Solve & Visualize
                </Button>
              </div>
            </div>
          </div>
        )}

        {status === AppStatus.ANALYZING && (
          <div className="animate-in fade-in duration-700 w-full max-w-6xl mx-auto">
             <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-100 dark:border-slate-700 overflow-hidden ring-1 ring-slate-100 dark:ring-slate-700">
                {/* Skeleton Header */}
                <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-700">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700 animate-pulse"></div>
                      <div className="h-6 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                   </div>
                   <div className="flex gap-2">
                      <div className="h-8 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                      <div className="h-8 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                   </div>
                </div>

                <div className="p-6 md:p-8 grid lg:grid-cols-2 gap-10">
                   {/* Left Column: Text Skeleton */}
                   <div className="space-y-6">
                      {/* Step 1 */}
                      <div className="space-y-3">
                         <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                         <div className="space-y-2 pl-4 border-l-2 border-slate-100 dark:border-slate-700">
                            <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                            <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                         </div>
                      </div>
                      
                      {/* Step 2 */}
                      <div className="space-y-3">
                         <div className="h-6 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                         <div className="h-16 w-full bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse"></div>
                      </div>

                      {/* Step 3 */}
                      <div className="space-y-3">
                         <div className="h-6 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                         <div className="space-y-2">
                             <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                             <div className="h-4 w-5/6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                             <div className="h-4 w-4/6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                         </div>
                      </div>
                      
                      {/* Thinking Indicator */}
                      <div className="flex items-center gap-3 pt-4 text-slate-400">
                         <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                         <span className="text-sm font-medium animate-pulse">AI is solving step-by-step...</span>
                      </div>
                   </div>

                   {/* Right Column: Visual Skeleton */}
                   <div className="space-y-6">
                      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 h-full min-h-[400px] flex flex-col">
                         <div className="flex items-center gap-2 mb-6">
                            <div className="w-8 h-8 rounded-md bg-slate-200 dark:bg-slate-700 animate-pulse"></div>
                            <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                         </div>
                         
                         <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse mb-4 flex items-center justify-center">
                            <DolphinLogo className="w-16 h-16 text-slate-300 dark:text-slate-600 opacity-50" />
                         </div>
                         
                         <div className="h-4 w-2/3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mx-auto"></div>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        )}

        {status === AppStatus.SOLVED && solution && (
          <div className="animate-in slide-in-from-bottom-8 duration-700 space-y-6">
            <div className="flex justify-between items-center bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm p-4 rounded-xl border border-white/50 dark:border-slate-700 shadow-sm">
               <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                 <span className="w-2 h-8 bg-indigo-500 rounded-full"></span>
                 Analysis Result
               </h2>
               <Button variant="outline" onClick={handleReset} size="sm" className="dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:text-white">
                 Upload New
               </Button>
            </div>
            <SolutionViewer 
              data={solution} 
              onGenerateVideo={handleGenerateVideo}
              videoStatus={videoStatus}
              videoUri={videoUri}
            />
          </div>
        )}

        {status === AppStatus.ERROR && (
           <div className="flex flex-col items-center justify-center py-10">
              <Button variant="secondary" onClick={handleReset}>
                Try Again
              </Button>
           </div>
        )}

      </main>

      <footer className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm border-t border-slate-200/50 dark:border-slate-800/50 bg-white/30 dark:bg-slate-900/30 backdrop-blur-sm">
        <p>© {new Date().getFullYear()} Dolphin AI. Powered by Gemini 3 Pro & Veo.</p>
      </footer>
    </div>
  );
};

export default App;