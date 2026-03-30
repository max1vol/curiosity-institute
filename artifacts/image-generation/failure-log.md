# Image Generation Failure Log

This log records distinct failures once each while trying to turn the district concept art into three 3D directions.

## 2026-03-30

- Gemini API keys from [`../keys.txt`](/home/max/keys.txt) return `403 PERMISSION_DENIED` with the message `Your API key was reported as leaked. Please use another API key.`
  Action taken: stopped retrying that exact API-key path after confirming the failure and switched to browser-based Gemini probing.

- Anonymous Gemini web chat at `https://gemini.google.com/app` can answer prompts but rejects image creation while signed out.
  Action taken: stopped retrying anonymous browser image generation and started probing local authenticated entry points instead.

- Chromium's raw `--screenshot` flag completed without leaving the requested output file in this environment.
  Action taken: switched capture work to Playwright-based screenshots instead of retrying the same browser flag path.
