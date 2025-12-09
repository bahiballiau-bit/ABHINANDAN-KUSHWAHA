import React, { useCallback, useState } from 'react';
import { Upload, FileType, CheckCircle, Image as ImageIcon } from 'lucide-react';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect, selectedFile }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  }, [onFileSelect]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  }, [onFileSelect]);

  return (
    <div className="w-full group">
      <label 
        className={`
          relative flex flex-col items-center justify-center w-full h-72 
          border-3 border-dashed rounded-3xl cursor-pointer transition-all duration-300
          ${isDragging 
            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/30 scale-[1.01] shadow-xl shadow-indigo-500/10' 
            : selectedFile 
              ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/30 shadow-lg shadow-emerald-500/5' 
              : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/5'
          }
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4 transition-transform duration-300 group-hover:scale-105">
          {selectedFile ? (
            <>
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mb-4 animate-in zoom-in duration-300">
                <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="mb-2 text-lg font-bold text-emerald-700 dark:text-emerald-400">File Ready</p>
              <p className="text-sm text-emerald-600 dark:text-emerald-300 truncate max-w-xs font-medium bg-emerald-100/50 dark:bg-emerald-900/30 px-3 py-1 rounded-full">{selectedFile.name}</p>
              <p className="mt-4 text-xs text-emerald-500 dark:text-emerald-400 uppercase tracking-wide font-semibold">Click to replace</p>
            </>
          ) : (
            <>
              <div className={`
                p-4 rounded-full mb-4 transition-colors duration-300
                ${isDragging ? 'bg-indigo-200 dark:bg-indigo-800' : 'bg-indigo-50 dark:bg-slate-700 group-hover:bg-indigo-100 dark:group-hover:bg-slate-600'}
              `}>
                <Upload className={`
                  w-10 h-10 transition-colors duration-300
                  ${isDragging ? 'text-indigo-700 dark:text-indigo-300' : 'text-indigo-500 dark:text-indigo-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300'}
                `} />
              </div>
              <p className="mb-2 text-lg font-medium text-slate-700 dark:text-slate-200">
                <span className="font-bold text-indigo-600 dark:text-indigo-400">Click to upload</span> or drag and drop
              </p>
              <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500 mt-2">
                 <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md"><ImageIcon className="w-3 h-3"/> PNG, JPG</span>
                 <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-md"><FileType className="w-3 h-3"/> PDF</span>
              </div>
            </>
          )}
        </div>
        <input 
          type="file" 
          className="hidden" 
          onChange={handleChange} 
          accept="image/*,.pdf" 
        />
      </label>
    </div>
  );
};