/**
 * Adresse de l'API. Vide en développement (proxy Vite vers le serveur local) ; en production, le widget est servi
 * par le FTP et lit l'API du VPS : VITE_API_BASE dans .env.production.
 */
const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export const apiUrl = (path) => `${API_BASE}${path}`;
