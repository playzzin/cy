// CRA exposes every REACT_APP_* variable, including values reached through
// dynamic process.env access. Strip former server credentials after .env loading.
function stripServerAiCredentials(environment = process.env) {
  for (const key of Object.keys(environment)) {
    if (/^REACT_APP_(?:GEMINI_API_KEY|GOOGLE_API_KEY|GOOGLE_GENAI_API_KEY|GENAI_API_KEY)$/i.test(key)) delete environment[key];
  }
}
module.exports = { stripServerAiCredentials };
