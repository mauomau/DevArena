'use client';

import React from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  levelId: number;
}

export default function CodeEditor({ value, onChange, levelId }: CodeEditorProps) {
  // Adaptation automatique du langage selon le niveau (1: HTML, 2: CSS, 3-5: JS)
  const getExtensions = () => {
    if (levelId === 1) return [html()];
    if (levelId === 2) return [css(), html()];
    return [javascript()];
  };

  const getFileName = () => {
    if (levelId === 1) return 'index.html';
    if (levelId === 2) return 'style.css';
    return 'script.js';
  };

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Onglet fichier style IDE */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950 border-b border-slate-800 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#9E1B24]"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37]"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span className="ml-2 text-slate-300 font-semibold">{getFileName()}</span>
        </div>
        <span className="text-slate-500">Éditeur CodeMirror</span>
      </div>

      {/* Zone d'édition */}
      <div className="flex-1 overflow-auto">
        <CodeMirror
          value={value}
          height="100%"
          theme="dark"
          extensions={getExtensions()}
          onChange={onChange}
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            autocompletion: true,
          }}
        />
      </div>
    </div>
  );
}