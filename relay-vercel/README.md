# Kyungnam FAQ relay (Vercel Hobby)

Isolated Node.js relay for the static FAQ page. It does not change the live page endpoint. Deploy this directory as its own Vercel project, then point the page at the resulting URL only after that URL exists.

The function accepts `POST /api/ask` with JSON `{ "question": string, "lang": "zh" | "ko" }` and returns `200 { "answer": string }`. `question` is at most 300 characters. A missing `lang` means Chinese. Any other failure is a non-200 JSON error with a short code, not the upstream body.

Upstream is `POST https://open.bigmodel.cn/api/paas/v4/chat/completions` with model `glm-4-flash`. The only secret is the environment variable `ZHIPU_API_KEY`. This repository does not contain a key.

## Hobby settings from current Vercel docs

Checked against Vercel documentation for Functions limits, regions, duration, and Node.js versions:

- Runtime: Node.js `24.x`, the current default for a new project. Also pinned in `package.json` `engines.node`. Do not select the Edge runtime.
- Plan: Hobby only. One function region. `vercel.json` sets `regions` to `["hkg1"]` (Hong Kong), the closest listed region to the Zhipu API. A second region fails the Hobby deploy.
- Duration: `functions["api/ask.mjs"].maxDuration` is 20 seconds, under the Hobby maximum of 300 seconds. The upstream abort is 12 seconds, shorter than the page's 15 second client timeout.
- Memory: Hobby Fluid Compute is fixed at 2 GB / 1 vCPU. Do not set memory in `vercel.json`; Fluid Compute ignores that field.
- No Blob, KV, Postgres, Cron, or other paid product.

## Deploy

1. In the existing Vercel Hobby team, create a project from this same Git repository. Do not create another repository.
2. Set the project Root Directory to `relay-vercel`. Framework Preset: Other. Node.js Version: 24.x.
3. Add environment variable `ZHIPU_API_KEY` in the Vercel dashboard for Production. Mark it sensitive. Do not commit it and do not paste it into Git.
4. Deploy. The public route is `POST https://<deployment-host>/api/ask`.
5. Leave the static page `AI_ENDPOINT` unchanged until that deployment URL is real.

Local check, with no upstream call:

```bash
npm test
```

Run from this directory. The tests mock `fetch`.

## Request and browser access

Allowed browser `Origin` values are `https://macshi716.github.io` and `http` or `https` on `localhost` or `127.0.0.1`, with or without a port. Other browser origins receive 403 and the function does not call Zhipu. A request with no `Origin` is accepted so a non-browser check can run. That is not authentication.

The response sets `Access-Control-Allow-Origin` to the approved origin only. Credentials are not allowed. CORS does not identify the caller. Anyone who can reach the deployment URL can POST to it.

Each instance keeps a small in-memory counter of about 30 requests per minute per forwarded client address. Another instance does not share that counter. It is not a quota, a bill cap, or a guarantee. Hobby included usage can still be consumed by traffic that passes this check. Logs do not record the question, the key, or the authorization header.
