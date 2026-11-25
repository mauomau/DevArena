'use client';

import { QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { CLUB } from '@/lib/game/config';

interface JoinQrCodeProps {
  /** Taille en pixels du QR code. */
  size?: number;
  /** Couleur des modules (le fond reste blanc pour rester scannable). */
  fgColor?: string;
  className?: string;
}

/**
 * QR code d'invitation au groupe WhatsApp du Club Dev.
 * Affiche un emplacement explicite si le lien n'est pas configuré, plutôt
 * qu'un QR code vide impossible à scanner.
 */
export default function JoinQrCode({
  size = 160,
  fgColor = '#9E1B24',
  className = '',
}: JoinQrCodeProps) {
  if (!CLUB.whatsappUrl) {
    const compact = size < 100;

    return (
      <div
        style={{ width: size, height: size }}
        title="Définis NEXT_PUBLIC_WHATSAPP_GROUP_URL pour générer le QR code"
        className={`flex flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 text-center text-slate-500 ${
          compact ? 'p-1' : 'p-4'
        } ${className}`}
      >
        <QrCode className={compact ? 'h-5 w-5' : 'h-7 w-7'} aria-hidden="true" />
        {compact ? (
          <span className="text-[9px] font-bold uppercase leading-none">QR</span>
        ) : (
          <>
            <span className="text-[11px] font-bold leading-snug">
              QR code à configurer
            </span>
            <span className="font-mono text-[9px] leading-tight break-all">
              NEXT_PUBLIC_WHATSAPP_GROUP_URL
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <QRCodeSVG
      value={CLUB.whatsappUrl}
      size={size}
      fgColor={fgColor}
      bgColor="#FFFFFF"
      level="M"
      marginSize={2}
      className={className}
    />
  );
}
