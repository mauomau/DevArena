'use client';

import React from 'react';
import { Eye, Terminal } from 'lucide-react';

interface LivePreviewProps {
  code: string;
  levelId: number;
}

export default function LivePreview({ code, levelId }: LivePreviewProps) {
  // Pour les niveaux 1 à 3 (HTML, CSS, JS DOM), on génère un aperçu web complet
  const getSrcDoc = () => {
    if (levelId === 2) {
      // Niveau 2 : CSS appliqué sur le bouton #cta attendu par le Pôle 2
      return `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: system-ui, sans-serif; padding: 24px; display: flex; justify-content: center; align-items: center; min-height: 80vh; margin: 0; background: #ffffff; }
              ${code}
            </style>
          </head>
          <body>
            <button id="cta">Rejoindre ESGIS</button>
          </body>
        </html>
      `;
    }

    if (levelId === 3) {
      // Niveau 3 : DOM avec #btn et #count attendus par le Pôle 2
      return `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: system-ui, sans-serif; padding: 24px; text-align: center; }
              button { background: #9E1B24; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; cursor: pointer; }
              #count { font-size: 2rem; font-weight: bold; margin-top: 16px; color: #1e293b; }
            </style>
          </head>
          <body>
            <button id="btn">Cliquer (+1)</button>
            <div id="count">0</div>
            <script>${code}<\/script>
          </body>
        </html>
      `;
    }

    // Niveau 1 : HTML libre
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>body { font-family: system-ui, sans-serif; padding: 24px; color: #1e293b; }</style>
        </head>
        <body>${code}</body>
      </html>
    `;
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* En-tête Aperçu */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
        <div className="flex items-center gap-2">
          {levelId <= 3 ? <Eye className="w-4 h-4 text-[#9E1B24]" /> : <Terminal className="w-4 h-4 text-[#9E1B24]" />}
          <span>{levelId <= 3 ? 'Aperçu en direct' : 'Exécution Algorithmique'}</span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Sandbox
        </span>
      </div>

      {/* Corps */}
      {levelId <= 3 ? (
        <iframe
          title="Aperçu en direct"
          srcDoc={getSrcDoc()}
          className="w-full flex-1 border-none bg-white"
          sandbox="allow-scripts"
        />
      ) : (
        <div className="flex-1 p-6 bg-slate-50 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-[#FDF2F3] border border-[#9E1B24]/20 flex items-center justify-center text-[#9E1B24]">
            <Terminal className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-slate-800">Tests unitaires automatisés</h4>
          <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
            Ce défi évalue la logique pure de ta fonction. Clique sur <strong>« Valider mon code »</strong> pour exécuter la batterie de tests cachés sur le serveur.
          </p>
        </div>
      )}
    </div>
  );
}