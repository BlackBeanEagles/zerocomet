# Agent Pager

**Your coding agent, in the group chat.**

Text `@Pager` from your phone. Claude Code edits the real repo on your laptop, runs the tests, and posts the diff back into the chat as a card. Your teammate taps **👍 Ship it** and it commits.

Built for **Zero to Chat**, the CometChat hackathon (#ZeroToChat). The build used the CometChat MCP connector (`.mcp.json`) throughout.

```
 phone / browser ──@Pager make the button orange──▶  CometChat group "Ship It"
        ▲                                                  │  (REST poll or Custom Agent callback)
        │                                                  ▼
        │                                  server/  on your laptop
        │                                    └─ claude -p  (inside workspace/ only)
        │                                    └─ git diff + npm test
        └──── result card: summary · diff · tests · 👍 Ship it ◀── REST: send message as the agent
```

## What CometChat does here

| CometChat piece | Used for |
|---|---|
| JS Chat SDK | the whole chat UI: login with server-minted auth tokens, group history, live messages |
| Custom messages | `agent_status` (live steps), `agent_result` (diff + tests card), `agent_event` (shipped, help, errors) |
| REST API | the agent speaks as a real group member (`onBehalfOf`); users, group and auth tokens are created server-side |
| Custom Agents | optional `callback` mode: CometChat relays group messages to `POST /cometchat/callback` |
| Presence + typing | online dots, "Sam is typing…", the agent's live "working" state |
| Reactions | 👍 on a result card approves the commit |

## How the CometChat MCP was used

`.mcp.json` registers `https://mcp.cometchat.com/mcp?ref=z2c`. The agent used it to:

- `list_cometchat_bundles` → picked `js-sdk-messaging-basics` + `presence-and-typing` (+ `multi-tenant-chat` for the server-minted auth-token pattern)
- `get_cometchat_implementation_bundle` → init/login/listener code in `web/src/lib/chat.js`
- `fetch_cometchat_doc_page` → `rest-api/messages/send-bot-message`, `list-group-messages`, `update-message`, `groups/create`, `ai-chatbots/custom-agents`, `sdk/javascript/reactions` → `server/cometchat.js`, `server/brain.js`
- `search_cometchat_docs` → rate limits (30 msgs/min per user, which is why status updates are throttled to one per 2.5 s) and the 10 KB `customData` cap (which is why diffs are trimmed to ~4 KB)

## Run it

You need Node 20+, Claude Code (`claude`, logged in) and a free CometChat account.

```bash
npm run install:all
cp .env.example .env        # then fill COMETCHAT_APP_ID, COMETCHAT_REGION, COMETCHAT_REST_API_KEY
npm run setup               # creates the agent user, Hridya + Sam, and the "Ship It" group
npm start                   # builds the web app and serves everything on http://localhost:8787
```

The REST API key is under **app.cometchat.com → your app → API & Auth Keys** (it needs full-access scope). App ID and region can also come from `npx @cometchat/skills-cli@3 auth login && npx @cometchat/skills-cli@3 provision run`.

**On your phone:** run `npm run tunnel` in a second terminal and open the `https://…trycloudflare.com` URL it prints. One tunnel serves the chat, the API and the live preview.

**No keys yet?** `npm start` still works. The app opens in a clearly labelled *Demo mode* with a simulated agent, so you can rehearse the UI. Set `MOCK_AGENT=1` in `.env` to use real CometChat with a fake agent (no Claude usage).

### Talking to the agent

| Message | What happens |
|---|---|
| `@Pager <change>` | Claude Code makes the change in `workspace/`, runs `npm test`, posts a result card |
| 👍 **Ship it** (button) or `/ship` | commits the change (in `workspace/.pager-git`) |
| **Undo** or `/undo` | throws the change away |
| `/status` | what it's doing + the last commits |
| `/new` | forget the conversation and start a fresh Claude session |

### Safety

- Only the UIDs in `HUMANS` can log in (tokens are minted server-side) or give orders. Anyone else gets a polite refusal.
- Claude runs with `cwd = workspace/`, `acceptEdits`, and an allow-list of tools: no `git push`, no `rm`, no web access.
- The Auth Key never reaches the browser; the REST key stays on the server.

## Layout

```
.mcp.json            CometChat MCP connector (project scope)
server/              express: tokens, poller/callback, Claude runner, live preview
web/                 React + Vite chat app (abstract palette, mobile-first)
workspace/           "Launchpad", the demo app the agent edits (node:test suite)
```

## 90-second demo script

| t | Shot |
|---|---|
| 0–8s | Title card: *What if your coding agent was in your group chat?* |
| 8–20s | Claude Code with the **cometchat** MCP calling `get_cometchat_implementation_bundle` / `fetch_cometchat_doc_page` |
| 20–30s | Phone: #ship-it with Hridya, Sam and **Pager** online |
| 30–48s | Type `@Pager make the signup button orange`; the live steps tick by (Reading… Editing… Running tests) |
| 48–62s | Split screen: the laptop's `/preview/` hot-reloads, the button turns orange |
| 62–76s | Result card on the phone: summary, ✓ 7 tests, diff. Sam taps **👍 Ship it** |
| 76–86s | "Shipped a1b2c3d" card; `/status` shows the commit |
| 86–90s | End card: Agent Pager · CometChat MCP · #ZeroToChat |
