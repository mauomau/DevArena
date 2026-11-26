export interface ValidationCheck {
  id: string;
  label: string;
  passed: boolean;
  /** Précision affichée au joueur (valeur détectée, attendu, etc.). */
  detail?: string;
}

export interface ValidationResult {
  valid: boolean;
  feedback: string;
  checks: ValidationCheck[];
}
