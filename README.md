# Hide & Seek (HTML + CSS + JS, no libraries)

## Run locally
    node server.js        # open http://localhost:3000 in several tabs

## Deploy
Vercel / GitHub Pages cannot keep a live game server, so split it:
1. Push this folder to GitHub.
2. Render.com -> New Web Service -> your repo -> Start command: `node server.js` (no build). Copy its URL.
3. Edit config.js: `window.SERVER_URL = "https://YOUR-APP.onrender.com";` and push.
4. Vercel -> Import repo -> Framework "Other", no build command. (Or enable GitHub Pages.)
Free Render sleeps when idle; the first load can take ~50 s.

## Rules
- Create a team (get a 5-letter code, optionally listed in the public directory) or join by code/directory.
- Each player picks Hider or Seeker in the lobby; host starts.
- 20 s hiding time (seekers are blind and frozen), then 3 min of seeking.
- Seeker sees only the 70% in front (252 deg): torch beam + short close range. The 30% behind is blind.
- A seeker who keeps a hider in view for 0.5 s puts him OUT (he then spectates).
- A hider who sneaks into the seeker's blind back and presses SPACE stuns that seeker for 8 s.
- Seekers win when all hiders are out; hiders win if time runs out.
Tweak numbers in the `C` object at the top of server.js and the house layout in map.js.
