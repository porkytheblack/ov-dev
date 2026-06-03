# Overwatch — Hosted Multitenant Cost, Pricing & Profitability Model

> Working financial model for running Overwatch as a hosted, multitenant SaaS.
> All figures are **estimates** derived from the architecture and the defaults
> in this repo (`ov-detector` YOLO inference, `SEGMENT_RETENTION_HOURS`,
> RTSP ingest, optional VLM, LLM agent over WhatsApp/Telegram). Treat them as a
> starting point — re-run the math once you've benchmarked real cameras-per-GPU
> for your model/`IMGSZ` settings.

---

## 1. The unit: cost and price per camera

Overwatch scales **per camera** (continuous 24/7 inference + video storage),
not per user. Cameras are therefore the unit we cost and price on — the same
model the surveillance market expects (Verkada, Rhombus, Eagle Eye all price
per camera/month).

Most of the ~15 services (`ov-api`, `ov-incident-engine`, `ov-notifier`,
`ov-station`, `ov-dashboard`, `ov-whatsapp`, `ov-telegram`, Postgres, Redis)
are lightweight and **shared across all tenants** — they are fixed overhead,
not per-camera cost.

---

## 2. Cost drivers

| Driver | Service | Scales with |
|---|---|---|
| **GPU inference** | `ov-detector` (YOLO 24/7) | # cameras |
| **Video storage** | `ov-ingestor` → MinIO/S3 | # cameras × retention × bitrate |
| **Egress** | `ov-stream-gateway` (WebRTC) + clip delivery | live-view + clip volume |
| **LLM / VLM tokens** | `ov-agent`, `ov-vlm` | # incidents + chat volume |
| **Shared baseline** | DB, Redis, 10+ TS/Py services | flat (amortized) |

### 2.1 Inference (dominant cost)

A single NVIDIA T4 (`g4dn.xlarge`) running `yolo11n` @ ~5fps/camera handles
**~20–30 cameras**; the heavier `yolo11l` default drops that to ~10–12.

| Setup | $/camera/mo |
|---|---|
| On-demand T4 ($380/mo), nano, 25 cams/GPU | ~$15 |
| Spot T4 (~$110/mo) / cheap cloud (RunPod, Lambda, Vast) + batching | ~$4–8 |

### 2.2 Storage

1080p @ ~2 Mbps ≈ 22 GB/day/camera. At 7-day hard retention ≈ 150 GB/camera.

| Backend | $/camera/mo |
|---|---|
| AWS S3 Standard ($0.023/GB) | ~$3.50 |
| Cloudflare R2 / Backblaze B2 / Wasabi (~$0.006/GB, **free egress**) | ~$1 |

### 2.3 Egress

A customer watching one 2 Mbps live stream ~2 hrs/day ≈ 54 GB/mo.
- AWS egress ($0.09/GB) → **~$5/mo per heavy live-view habit** (the silent killer)
- Cloudflare R2 / Hetzner (free/cheap egress) → **~$0**

> **Biggest single lever: host storage + streaming on free-egress infra.**

### 2.4 LLM / VLM / messaging

With `gemini-3.1-flash-lite` (OpenRouter default) for incident summaries +
the agent: fractions of a cent per incident/message → **~$0.20–1/cam/mo**.
WhatsApp Cloud API adds ~$0.01–0.03 per alert conversation; Telegram is free.

### 2.5 Blended per-camera cost

| Scenario | $/camera/mo |
|---|---|
| **Lean** (cheap GPU, R2, nano model, Telegram) | **$7–10** |
| **Mainstream** (AWS, S3, moderate live view, WhatsApp) | **$20–28** |
| **Heavy** (yolo11l, long retention, heavy WebRTC on AWS) | **$40–55** |

**Shared baseline:** ~**$300–800/mo** flat (managed Postgres, Redis, 2–3 app
nodes). Amortizes to ~$2–4/cam at 200+ cameras; painful below ~20 cameras —
cover it with a platform minimum.

---

## 3. Pricing

Price per camera/month, target **70–80% gross margin**.

| Tier | $/camera/mo | Includes |
|---|---|---|
| **Starter** | **$15–20** | 48h retention, Telegram alerts, nano model |
| **Pro** | **$30–40** | 7-day retention, WhatsApp, live view, VLM summaries |
| **Business** | **$50–80** | 30-day retention, yolo11l, priority support, SLA |

- **Platform minimum:** $49–99/mo or a 5-camera floor, so 1–2 camera tenants
  still cover the shared baseline.
- **Retention + live streaming as add-ons** — they're your most variable costs;
  don't bundle them flat.
- Positions below Verkada/Rhombus (~$50–100+/cam with hardware lock-in) as the
  affordable software-first option while keeping margin.

---

## 4. Break-even

**Model:** treat the shared baseline as fixed cost, GPU/storage/egress/LLM as
variable per-camera. Break-even = `Fixed ÷ (Price − Variable cost)` per camera.

Assumptions: **Lean infra** (variable ≈ $8.50/cam), **fixed = $500/mo**.

| Price tier | Contribution / cam | Break-even (cameras) | Break-even (tenants @ 4 cams) |
|---|---|---|---|
| Starter $18 | $9.50 | **~53 cams** | ~13 |
| Pro $35 | $26.50 | **~19 cams** | ~5 |
| Business $65 | $56.50 | **~9 cams** | ~2–3 |

On **mainstream AWS infra** (variable ≈ $24/cam, fixed = $700/mo):

| Price tier | Contribution / cam | Break-even (cameras) |
|---|---|---|
| Starter $18 | −$6 | **never** (priced below cost — don't offer Starter on AWS) |
| Pro $35 | $11 | **~64 cams** |
| Business $65 | $41 | **~17 cams** |

> Takeaway: on lean/free-egress infra you break even around **20 cameras (≈5
> small tenants)** at Pro pricing. On naive AWS on-demand you need **3×** the
> volume — infra choice moves break-even more than pricing does.

---

## 5. Profit projections

Lean infra, blended **$32/camera** average revenue (mix of tiers),
**$8.50/camera** variable cost, **$500/mo** fixed baseline (steps up with scale
as noted).

| Cameras | Tenants¹ | Revenue/mo | Variable | Fixed | **Profit/mo** | Margin |
|---:|---:|---:|---:|---:|---:|---:|
| 20 | 5 | $640 | $170 | $500 | **−$30** | — |
| 50 | 13 | $1,600 | $425 | $500 | **$675** | 42% |
| 200 | 50 | $6,400 | $1,700 | $700 | **$4,000** | 63% |
| 500 | 125 | $16,000 | $4,250 | $1,200 | **$10,550** | 66% |
| 1,000 | 250 | $32,000 | $8,500 | $2,000 | **$21,500** | 67% |

¹ ~4 cameras/tenant assumed.

**Same camera counts on mainstream AWS** ($24/cam variable, fixed steps
$700→$2,500):

| Cameras | Revenue/mo | Variable | Fixed | **Profit/mo** | Margin |
|---:|---:|---:|---:|---:|---:|
| 50 | $1,600 | $1,200 | $700 | **−$300** | — |
| 200 | $6,400 | $4,800 | $1,000 | **$600** | 9% |
| 500 | $16,000 | $12,000 | $1,500 | **$2,500** | 16% |
| 1,000 | $32,000 | $24,000 | $2,500 | **$5,500** | 17% |

> Same revenue, **~4× the profit on lean infra.** Margin is an infrastructure
> decision before it's a pricing one.

> **Note:** these are *gross* infra margins. Subtract people, support, sales,
> payment fees (~3%), free trials, and idle/over-provisioned capacity — budget
> another 20–35% of revenue. A 60%+ gross infra margin is the floor that keeps
> the business viable after those.

---

## 6. Levers that move economics most

1. **Free-egress storage + streaming** (Cloudflare R2, Hetzner, Backblaze) —
   zeroes out the biggest hidden AWS cost.
2. **Batch GPU inference + spot/interruptible GPUs** — `ov-detector` already has
   `BATCH_SIZE=4`; packing many tenants' cameras per GPU 2–3×'s cameras-per-GPU
   and is the single biggest margin lever.
3. **Sample fps, don't process every frame** — 5fps vs 25fps ≈ 5× less inference
   with little loss for linger-based incidents.
4. **Default to short retention; sell longer as an upsell** — storage is linear
   in retention days.
5. **Tenant isolation** — verify Postgres row-level isolation and per-tenant S3
   prefixes; a noisy/abusive tenant on shared GPUs is a real cost *and* security
   risk.

---

## 7. Open question to tighten the model

The widest range above is **cameras-per-GPU**. Benchmark `ov-detector` with your
production `MODEL_PATH` / `IMGSZ` / `BATCH_SIZE` to replace the 20–30 (nano) and
10–12 (yolo11l) estimates with measured throughput — that single number drives
both per-camera cost and break-even.
