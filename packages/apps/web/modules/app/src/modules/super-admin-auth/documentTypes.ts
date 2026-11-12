/** Tipos de documento de identidad que acepta el servicio (debe coincidir con el backend). */
export type DocumentType = "CC" | "CE" | "PA" | "NIT";

export const DOCUMENT_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: "CC", label: "Cédula de ciudadanía" },
  { value: "CE", label: "Cédula de extranjería" },
  { value: "PA", label: "Pasaporte" },
  { value: "NIT", label: "NIT" },
];

export const DEFAULT_DOCUMENT_TYPE: DocumentType = "CC";
