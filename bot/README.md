# WhatsApp absence intake bot

This is the WhatsApp **data collection** component of the [Autism Partnership challenge](../docs/AutismPartnership-Challenge-Statement-CFG2026.pdf). Unexpected absences must be reported by 7:00 a.m.; operations have until 7:30 a.m. to publish a revised schedule. A therapist absence or a child's absence can affect one-to-one care, so the bot collects structured reports quickly, but **does not reschedule, approve an MC, or notify families about a change**. Those decisions remain with admin and clinical supervisors. See [challenge notes](../docs/challenge_notes.md) for the wider team workflow.

## Reporter journey

1. Send `START` to the business's WhatsApp number; choose **Therapist** or **Patient / child**. Parents/caregivers report using the *child's* name.
2. Type the name. To report unavailability, tap **Today**, **Tomorrow**, or **Other dates**. Other dates opens a WhatsApp list of the next nine dates, then **One day** or **Date range**. For dates farther ahead or several nonconsecutive absences, choose **Type a date / range** and send `DD/MM/YYYY to DD/MM/YYYY, DD/MM/YYYY`. Dates are interpreted in Singapore time; the endpoints are inclusive. Choose **Whole day**, **Morning**, or **Afternoon**.
3. Optionally send an MC image or PDF **at any stage**. The bot downloads it from Meta, extracts *tentative* name and absence dates locally (embedded PDF text, or local OCR for images/scanned PDFs), and asks the reporter to review them. It does not interpret the issue date as an absence. If extraction fails or the wording is ambiguous, type the dates instead. Up to five PDF pages and 10 MB are supported; English OCR needs an `eng` model download on its first run. The raw document, its OCR text and diagnosis are **not stored** by the bot.
4. Review **name, dates, day part, and MC attachment** and tap **Confirm**, **Edit** or **Cancel**. A confirmed report is saved as `pending_admin_review`; the reply does **not** imply approval or an updated schedule. Send `CANCEL` to abandon an unfinished report.

This hybrid is faster than forcing a calendar for the frequent same-day/next-day case, allows multi-day and disjoint absences without a long chain of taps, and does not depend on deploying a separate WhatsApp Flow or Flow encryption endpoint. WhatsApp lists have ten rows and reply messages have at most three buttons.

## Run locally

Requires Node.js **24+**. Run the following from the `bot/` directory. Use a registered Meta WhatsApp Cloud API business number with a subscribed **messages** webhook. The public webhook must be served over HTTPS (e.g. through your existing reverse proxy or a development tunnel). Do not expose the SQLite database or admin export over HTTP.

```powershell
npm.cmd ci
$env:WHATSAPP_TOKEN = 'your-token'
$env:WHATSAPP_PHONE_NUMBER_ID = 'your-phone-number-id'
$env:META_APP_SECRET = 'your-meta-app-secret'
$env:META_VERIFY_TOKEN = 'your-random-webhook-verify-token'
npm.cmd start
```

Register `https://your-domain.example/webhook` in Meta and supply the same verification token. Configure the system user's access token with `whatsapp_business_messaging` for inbound media and replies. Optional variables are listed in [.env.example](.env.example); the server does not automatically load `.env`. `GRAPH_API_VERSION` should be set to a currently supported Meta Graph API version for your app. `DB_PATH` defaults to `absences.sqlite`; `OCR_CACHE_DIR` defaults to `node_modules/.cache/absence-bot` and needs write access to download the local English OCR model once. Pre-warm the OCR cache before the 7:00 a.m. window, and provision network access for the initial model download; documents themselves are processed locally.

Run tests with `npm.cmd test`. They include webhook signature and duplicate checks, Singapore-time date validation, end-to-end persistence, image OCR, and scanned PDF OCR. No live Meta credentials are needed for tests.
To download the OCR model before opening intake, run `node --input-type=module -e "import { createMcWorker } from './src/mc.js'; const worker = await createMcWorker(); await worker.terminate()"` on the server once.

## Windows demo launcher

The demo launcher starts this bot and Cloudflare Tunnel together, then registers its HTTPS `/webhook` address and the `messages` subscription with Meta. If either process exits, it restarts it. A quick tunnel gets a new random address on every start; the launcher updates Meta automatically. Use **one host** for the demo, since Meta sends the webhook to only one configured address and the SQLite data stays on that host.

1. Run `npm.cmd ci` in `bot/`, then `./scripts/install-cloudflared.ps1` in PowerShell. The installer places Cloudflare's executable under the ignored `node_modules/.cache/` folder.
2. Fill the ignored `bot/.env` with `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `META_APP_ID`, `META_APP_SECRET`, and `META_VERIFY_TOKEN`. Use IDs from the **same Meta app and WhatsApp account**. Keep the optional `WEBHOOK_URL` and `CLOUDFLARE_TUNNEL_TOKEN` empty for a quick tunnel. Never commit or share the access tokens.
3. Stop any bot already using port 3000. Run `npm.cmd run demo` from `bot/`. Leave this running. The launcher logs its progress to `node_modules/.cache/absence-bot/demo.log` without logging tokens.
4. On the host that will stay on for the demo, run `./scripts/install-autostart.ps1` once. It creates a task named `Team18 WhatsApp Demo Bot` that starts the launcher at that user's Windows sign-in. Stop the foreground launcher before running `Start-ScheduledTask -TaskName 'Team18 WhatsApp Demo Bot'`. The host must stay awake and signed in.

For a **stable URL**, create a named Cloudflare Tunnel and a public hostname in the Cloudflare dashboard. Route the hostname to `http://127.0.0.1:3000`. Set `WEBHOOK_URL=https://your-hostname.example/webhook` and `CLOUDFLARE_TUNNEL_TOKEN` in `.env`, then restart the launcher. It will start the named tunnel using the token from its environment and register the stable callback with Meta. This requires a Cloudflare account and a domain managed there; the quick tunnel mode works without either but has no uptime guarantee.

The Meta **test number** can only be used with test recipients added in the Meta dashboard. For a lasting demo, replace Meta's temporary WhatsApp access token with a system-user token that has access to the WhatsApp account and `whatsapp_business_messaging` plus `whatsapp_business_management`. The launcher cannot renew a temporary Meta token. To inspect it, run `Get-Content node_modules/.cache/absence-bot/demo.log -Tail 30` from `bot/`; avoid pasting logs containing real message details into public channels.

After changing `WHATSAPP_TOKEN` in the ignored `.env`, restart the installed task so the bot and tunnel load the new token and register the new callback:

```powershell
Stop-ScheduledTask -TaskName 'Team18 WhatsApp Demo Bot'
Start-ScheduledTask -TaskName 'Team18 WhatsApp Demo Bot'
```

Wait until the log says `Webhook connected:` before testing. The task's Quick Tunnel URL changes on restart, and the launcher updates Meta automatically.

`npm.cmd run export` prints JSON with `absences` (phone numbers, names, dates, day part, MC-attached flag and review status) and `failedReplies` needing operator follow-up. Treat this as sensitive data: restrict filesystem access, export only to an approved admin workflow, verify the sender's identity and claimed child/therapist against the official roster, and have staff review the original MC in the existing WhatsApp conversation if required. The bot stores an MC media ID and SHA-256 digest for traceability, **not the document**; media availability on Meta is limited, so an approved separate evidence-retention process is necessary if MC copies must be kept. Keep the database on an access-controlled, encrypted volume, define a retention/deletion policy, and protect access tokens and server logs. Until the roster check is done, these submissions must **not** be fed into an automatic schedule change.

Inbound message IDs deduplicate webhook retries. Drafts, pending inbound messages and outgoing replies are stored in SQLite; failed outbound sends are retried independently every 30 seconds (up to five attempts), and IDs of failed inbound jobs are logged for operator investigation. Failed outgoing replies appear in `failedReplies` rather than blocking other reporters. Completed message payloads are cleared; only confirmed structured reports and audit entries remain. Delivery may be repeated if a process crashes between WhatsApp accepting a reply and the local `sent_at` update. Meta's WhatsApp conversation-window/template rules still apply to any *proactive* follow-up messages; this bot only replies to inbound reports.

## Data shape for scheduling integration

Each `absences` row holds `role`, `name`, `phone`, `start_date`, `end_date` (ISO dates, inclusive), `day_part`, optional `mc_media_id` / `mc_sha256` / `mc_mime`, `status`, `inbound_id`, and `created_at`. A multi-interval report creates one row per interval and one audit event recording the originating inbound ID. Operators should resolve the `pending_admin_review` status only after identity, MC and scheduling constraints are checked; this component does not implement a clinical approval interface.
