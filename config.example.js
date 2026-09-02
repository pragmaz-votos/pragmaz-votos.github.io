// ============================================================================
// PLANTILLA — este archivo SÍ se sube al repositorio (no tiene secretos).
//
// El archivo real "config.js" que las 3 páginas cargan en tiempo de ejecución
// NUNCA se commitea: lo genera automáticamente el workflow de GitHub Actions
// (.github/workflows/deploy.yml) a partir de los Secrets del repositorio,
// cada vez que se publica el sitio. Por eso "config.js" está en .gitignore.
//
// Esta plantilla es solo para que cualquiera que abra el repo entienda la
// forma del archivo y, si quieres probar la página en tu propia máquina
// antes de publicarla, puedas copiarla a mano:
//   cp config.example.js config.js   (y rellena los 4 valores)
// ============================================================================
window.PRAGMAZ_CONFIG = {
  SUPABASE_URL: 'https://YOUR-PROJECT-REF.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR-ANON-PUBLIC-KEY',
  VOTER_EMAIL: 'votantes@pragmaz-votos.app',
  VOTER_PASSWORD: 'CAMBIA-ESTE-CODIGO-DE-ACCESO',
};
