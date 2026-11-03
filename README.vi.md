# devin-2api

<p align="center">
  <img src="docs/images/logo.png" alt="devin-2api logo" width="128">
</p>

<p align="center">
  <a href="https://wncfht.github.io/devin2api/"><img src="https://img.shields.io/badge/%F0%9F%93%96%20User%20Guide-blue" alt="User Guide"></a>
</p>

> [English](README.md) | [中文](README.zh-CN.md) | **Tiếng Việt**

devin-2api là một adapter giao thức không chính thức, đưa các model mà tài khoản Devin của bạn ([app.devin.ai](https://app.devin.ai/)) được quyền dùng ra sau các endpoint tương thích OpenAI và Anthropic — để client chuẩn (Codex, Claude Code, SDK bất kỳ) gọi được qua API quen thuộc.

> **Lưu ý**: dự án này không trực thuộc và không được Cognition bảo trợ. Nó xác thực bằng chính credentials Devin của bạn (session token hoặc platform key bền) trên một bề mặt RPC nội bộ, chỉ nhằm mục đích cá nhân với tài khoản của bạn; bạn tự chịu trách nhiệm tuân thủ điều khoản dịch vụ của Devin.

## Tính năng

- **Ba mặt API trên một upstream** — `POST /v1/responses` (OpenAI Responses, kèm transport WebSocket cho phiên multi-turn kiểu Codex), `POST /v1/chat/completions` (OpenAI Chat), `POST /v1/messages` (Anthropic Messages)
- **Streaming và non-streaming** (SSE typed / JSON)
- **Reasoning round-trip** — chữ ký thinking được giữ nguyên và phát lại qua các turn: `encrypted_content` reasoning item trên Responses, `redacted_thinking` trên Anthropic, `reasoning_content` trên Chat
- **Tool calling** — tool call custom/freeform (ví dụ `apply_patch`) round-trip nguyên vẹn; tên tool và `tool_choice` được validate cục bộ; re-pairing call↔result chặt theo đúng cái upstream bắt buộc. `web_search` do server quản lý được thực thi qua RPC search của upstream và trả về item `web_search_call`/`server_tool_use` gốc — một side request WebSearch của Claude Code được nối tắt thành một managed search duy nhất
- **Đầu vào ảnh/tài liệu/video** — `input_image`, `input_file`/`file`/`document`, và `video`/`video_url`/`input_video` giải mã trên cả ba mặt (gồm block `image`/`document`/`video` của Anthropic). Cờ capability theo model chặn cục bộ trước khi đi lên wire, nên model không hỗ trợ sẽ báo lỗi nhanh thay vì âm thầm làm mất attachment; video chỉ là frame, không có audio
- **Khôi phục stream upstream** — token hết hạn được nạp lại từ nguồn credentials, lỗi upstream trước content (đứt transport, im lặng bất thường, reply rỗng) được retry trong suốt, và lỗi sớm trả về HTTP error thật thay vì SSE error sau khi đã commit `200`
- **Detached completion cache** — client disconnect không giết stream upstream: nó chạy tiếp phía server vào cache hoàn thành, và một retry giống hệt ngữ nghĩa sẽ gắn lại — entry đã xong replay tức thì, entry đang chạy replay phần prefix đã buffer rồi đi tiếp live. Entry tồn tại qua restart
- **Pool nhiều tài khoản upstream** — mỗi lane trong `devin.accounts` mang credentials, rate gate và quota tracking riêng. Session affinity key (`X-Claude-Code-Session-Id`, `X-Session-ID`/`X-Session-Affinity`/`X-Conversation-Id`/`X-Thread-Id`, `metadata.user_id`, `prompt_cache_key`/`user`) ghim một hội thoại vào một lane, lỗi upstream fail over sang lane còn khoẻ, quota tuần thấp sẽ hạ lane khi nhận session mới. Lane được quản trực tiếp từ `/web/accounts.html` — pool rỗng là trạng thái khởi đầu hợp lệ
- **Rate-limit gate** — `resource_exhausted` từ upstream gài một chốt cooldown cục bộ: request xếp hàng chờ ngắn rồi fast-fail `429` + `Retry-After` thay vì đánh dồn upstream đang giới hạn, probe nhỏ giọt phát hiện phục hồi, và trạng thái chốt tồn tại qua restart (trong `devin-2api.db`). Một token bucket `max_rpm` tuỳ chọn còn định hình áp lực gửi trước khi chốt cần gài
- **Prefix warming tuỳ chọn** — replay body request của session đã giữ theo chu kỳ để gia hạn upstream prompt cache, để subagent resume sau chờ dài không trả giá cold prefill (`devin.warm_prefix_*`, mặc định tắt; xem `docs/upstream-cache.md`)
- **Hợp đồng lỗi chuẩn hoá** — mã lỗi upstream map sang HTTP status và error type theo từng protocol; rate limit thành `429` + `Retry-After`; bật request logging (`debug.enabled`, bật sẵn trong `config.example.yaml`) mỗi request mang `X-Request-Id`/`debug_ref` trỏ bản ghi debug của nó
- **`/v1/models` với capability flags** — context window cùng tool/thinking/image/document/video support lấy từ catalog upstream; entry trong `devin.aliases` xuất hiện với `alias_of`, và model registry trong panel có thể disable hoặc redirect từng tên
- **Admin panel tại `/web`** — trình duyệt request, tổng hợp usage/cost, theo dõi quota, process metrics, debug payload từng request, quản token downstream, điều khiển lane của pool, model registry, xem config đã che secret với hot reload cho hầu hết trường, và cập nhật tự thân một lần bấm trên bản cài được quản
- **Binary tĩnh đơn** — image Docker công khai trên [GHCR](https://github.com/WncFht/devin2api/pkgs/container/devin2api)

## Bắt đầu nhanh

### 1. Cung cấp credential Devin

devin-2api xác thực với Devin bằng một credential cho mỗi tài khoản upstream trong `devin.accounts` — mô hình pool bao phủ cả setup một tài khoản (`accounts` chỉ là list một entry), và pool rỗng là hợp lệ: boot trước, thêm tài khoản sau từ panel (`/web/accounts.html`) không cần restart. Mỗi entry nhận một (hoặc nhiều) trong ba nguồn credential:

- **`api_key` (khuyến nghị)** — platform key Devin bền (`cog_...`) cấp tại [app.devin.ai](https://app.devin.ai/) → Settings → API keys. Không kèm hạn dùng sẵn (có hiệu lực đến khi thu hồi): khi upstream báo `unauthenticated`, lane tự đúc một session token mới từ nó, nên tài khoản chỉ có `api_key` tự lành vô hạn mà không cần bảo trì.
- **`token`** — một Devin session token (`devin-session-token$...`). Dùng được trực tiếp, nhưng session token có TTL phía server — khi nó chết, lane chỉ phục hồi được nếu một nguồn khác cho ra credential mới. Lấy ở đâu: giá trị `windsurf_api_key` trong `credentials.toml` sau `devin auth login` (xem bên dưới), hoặc trích từ local state của app Devin (snippet macOS bên dưới).
- **`credentials_file`** — trỏ tới file credential của Devin CLI (`~/.local/share/devin/credentials.toml` trên macOS/Linux; `%APPDATA%\devin\credentials.toml` trên Windows), chứa session token mà CLI tự gia hạn khi bạn login lại — đọc lại file sẽ bám theo lần gia hạn của CLI. `devin` CLI nằm trong [Devin desktop app](https://devin.ai/download) ở `resources/app/extensions/windsurf/devin/bin/` — ví dụ `C:\Program Files\Windsurf\` trên Windows, `/usr/share/devin-desktop/` từ gói `.deb` Linux — chạy `devin auth login`, hoàn tất đăng nhập trên trình duyệt, file trên sẽ xuất hiện.

Kết hợp nhiều nguồn trên một tài khoản được — ví dụ `api_key` + `token`: literal token phục vụ đến khi chết, sau đó key bền đúc thay.

Trên macOS bạn cũng có thể trích session token từ local state của app Devin:

```bash
sqlite3 ~/Library/"Application Support"/Devin/User/globalStorage/state.vscdb \
  "SELECT json_extract(value, '$.apiKey') FROM ItemTable WHERE key='windsurfAuthStatus';"
```

Khi upstream trả `unauthenticated`, lane resolve lại credential của tài khoản đó — đọc lại `credentials_file` (bám lần gia hạn của CLI) → token row/config nếu đã đổi → đúc từ `api_key` — nên mọi nguồn trừ literal token đơn lẻ đều tự lành proxy mà không cần restart.

### 2. Cấu hình

```bash
cp config.example.yaml config.yaml
```

Sửa `config.yaml` và khai báo tài khoản trong `devin.accounts` (từ `config.example.yaml`, một entry `{name, token}` là đủ — base URL và model đã có sẵn ví dụ).

### 3. Chạy

Năm đường cài, cùng về một binary — khác nhau ở ai quản tiến trình và cách nâng cấp.

#### Option A: install script (khuyến nghị trên Linux & macOS)

```bash
curl -sSL https://raw.githubusercontent.com/WncFht/devin2api/main/scripts/install.sh | bash
```

Một lệnh, không clone, không root. `install.sh` tải pipeline deploy ở tag chỉ định và chuyển giao cho script deploy theo nền tảng — binary vào `~/.local/bin`, config và state vào thư mục nền tảng (bảng option B), và service chạy dưới `systemd --user` (Linux) hoặc launchd (macOS) với bàn giao REUSEPORT zero-downtime mỗi lần restart. Subcommand: `install` (mặc định; `-v <tag>` ghim một release), `upgrade`, `rollback <tag>`, `status`, `list-versions`, `uninstall` (gỡ service + binary, giữ config và logs). Trên Windows dùng PowerShell script của option B hoặc option C.

Ở lần chạy đầu `config.yaml` được sinh từ `config.example.yaml` với `dashboard.password` ngẫu nhiên, và bạn được hỏi Devin token (bỏ trống thì pool khởi đầu rỗng — thêm tài khoản sau từ panel); token `/v1` downstream được tạo trong panel (`/web/tokens.html`), không bao giờ trong config. Muốn preset giá trị, `cp config.example.yaml config.yaml` rồi sửa trước.

Trên Linux, chạy `loginctl enable-linger $USER` nếu cần service sống qua phiên đăng nhập của bạn.

#### Option B: deploy script từ checkout

Cùng service được quản như option A nhưng điều khiển từ bản clone — hữu ích khi bạn muốn repo nằm trên đĩa, vì script coi repo là nhà (đồng bộ `config.yaml` vào thư mục config nền tảng, giữ symlink `logs` trong repo trỏ về state dir):

```bash
git clone https://github.com/WncFht/devin2api && cd devin2api
bash scripts/deploy/deploy-linux.sh --release latest    # macOS: scripts/deploy/deploy.sh
```

`--release latest` tải binary đã sha256-verify, rồi script poll `/healthz` đến khi version mới trả lời và probe `GET /v1/models` để khẳng định auth upstream hoạt động. `--check` báo version đã cài/đang chạy/mới nhất; `--uninstall` gỡ service và binary nhưng giữ config và logs; `--no-restart` đổi binary mà không restart. Sinh config lần đầu giống option A.

| Nền tảng | Supervisor                              | Bố cục                                                                                                       | Script                              |
| -------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| macOS    | launchd agent                           | bin `~/.local/bin` · config+state `~/Library/Application Support/devin-2api`                                 | `scripts/deploy/deploy.sh`          |
| Linux    | `systemd --user`                        | bin `~/.local/bin` · config `~/.config/devin-2api` · state `~/.local/state/devin-2api`                       | `scripts/deploy/deploy-linux.sh`    |
| Windows  | không — console, hoặc NSSM / Task Scheduler | exe `%LOCALAPPDATA%\Programs\devin-2api` · config `%APPDATA%\devin-2api` · state `%LOCALAPPDATA%\devin-2api` | `scripts/deploy/deploy-windows.ps1` |

Trên Windows `deploy-windows.ps1 -Release latest` sinh `config.yaml` bind loopback trên cổng trống (tránh prompt firewall và lộ bare) và khởi động instance trong console window riêng — chạy từ phiên interactive local, không qua SSH (job object giết instance khi phiên kết thúc).

#### Option C: binary build sẵn

Asset trên [Releases](https://github.com/WncFht/devin2api/releases) đặt tên `devin-2api-{darwin,linux}-{amd64,arm64}`; Windows xuất bản bundle `devin-2api-windows-{amd64,arm64}.zip` (exe + `config.example.yaml` + LICENSE). `checksums.txt` kèm theo để kiểm chứng:

```bash
# ví dụ Linux; trên macOS dùng devin-2api-darwin-arm64 hoặc -darwin-amd64
curl -fLO https://github.com/WncFht/devin2api/releases/latest/download/devin-2api-linux-amd64
curl -fLO https://github.com/WncFht/devin2api/releases/latest/download/checksums.txt
sha256sum -c checksums.txt --ignore-missing   # mong đợi: devin-2api-linux-amd64: OK
chmod +x devin-2api-linux-amd64
./devin-2api-linux-amd64 -config config.yaml
```

Trên Windows: giải nén, sửa `config.yaml` (một tài khoản có thể chỉ mang `credentials_file` — bước 1 nói về `devin.exe` đi kèm Windsurf sinh ra file credential đó), rồi chạy `devin-2api.exe -config config.yaml` trong console. Ctrl+C kích hoạt graceful drain đúng nghĩa; đóng cửa sổ và `taskkill /F` thì không — Windows không có cơ chế giết console process một cách nhẹ nhàng.

Giải quyết đường dẫn: config qua flag `-config` → `DEVIN2API_CONFIG` → `./config.yaml` → mặc định nền tảng trong bảng option B; state qua `-state-dir` → `DEVIN2API_STATE_DIR` → mặc định nền tảng.

#### Option D: Docker

Image được publish trên [GHCR](https://github.com/WncFht/devin2api/pkgs/container/devin2api):

```bash
docker run --rm -p 8080:8080 \
  -v "$PWD/config.yaml:/app/config.yaml" \
  -v devin2api-state:/app/state \
  -e DEVIN2API_STATE_DIR=/app/state \
  ghcr.io/wncfht/devin2api --config /app/config.yaml
```

Volume state giữ `devin-2api.db` (token downstream, request logs, quota samples) qua các lần restart container — không có nó mỗi lần chạy bắt đầu với store rỗng, nghĩa là `/v1` mở toang.

#### Option E: từ source

Proto binding đã generate được commit sẵn trong `outputs/devin-proto-go`, nên clone xong build luôn không cần toolchain thêm:

```bash
go run ./cmd/devin-2api -config config.yaml
```

#### Nâng cấp

Bản cài được quản (option A–B) tự cập nhật từ panel — `/web/settings.html` có card cập nhật version: check → download → sha256 verify → swap → restart qua cùng bàn giao REUSEPORT, nên không rớt gì và panel poll tiến trình xuyên qua quá trình đổi process. `POST /admin/update` (với `/admin/update/check`, `/admin/update/status`, `/admin/update/rollback`) mở cùng luồng cho script; rollback phát lại việc swap trên binary `.backup` mà lần update để lại — không cần download. Ở nơi khác — binary chạy tay, console Windows, Docker — endpoint trả `501`: chạy lại đường cài của bạn (deploy script, tải bản mới, hoặc pull image mới).

### 4. Kiểm chứng

```bash
curl http://localhost:8080/healthz
# {"status":"ok","version":"...","uptime_seconds":12,"debug_logging":false}
```

## Sử dụng

> **Lưu ý**: endpoint `/v1/*` được kiểm soát bởi token store (bảng `auth_tokens` trong `devin-2api.db`, state dir): client gửi `Authorization: Bearer <token>` hoặc `X-Api-Key: <token>` khớp một hàng token đang hoạt động. Token chỉ quản trong panel (`/web/tokens.html`) — plaintext chỉ hiện một lần lúc tạo và store giữ hash; config không chứa credential data-plane. Store rỗng nghĩa là mở toang — chỉ bind ngoài loopback khi store đang gating, nếu không bạn đang phát quota Devin của mình cho cả mạng. Token có `class` tuỳ chọn (`fg` mặc định / `bg` cho batch traffic không người trông) thay đổi cách gate cấp quyền vào — xem `docs/gate-classes.md`.

Endpoints:

- `POST /v1/responses` — OpenAI Responses (`GET` trên cùng path đàm phán transport WebSocket)
- `POST /v1/chat/completions` — OpenAI Chat Completions
- `POST /v1/messages` — Anthropic Messages
- `GET /v1/models`, `GET /v1/models/{model}` — catalog model upstream với capability flags
- `GET /web/*` — admin panel (trình duyệt request, usage, quota, process stats); `dashboard.password` bảo vệ nó

Proxy là **stateless**: mỗi HTTP request phải mang full hội thoại — `previous_response_id` bị từ chối bằng lỗi tường minh thay vì âm thầm làm mất context (không có response store phía server; response báo `store=false`). Trên transport WebSocket, session multi-turn được giữ theo connection và incremental input được mở rộng thành transcript đầy đủ trong suốt.

Gọi `http://localhost:8080/v1/responses` với OpenAI Responses API client của bạn.

Non-streaming:

```bash
curl http://localhost:8080/v1/responses \
  -H "Content-Type: application/json" \
  -d '{
    "model": "swe-2-max",
    "input": "Hello"
  }'
```

Streaming (SSE):

```bash
curl -N http://localhost:8080/v1/responses \
  -H "Content-Type: application/json" \
  -d '{
    "model": "swe-2-max",
    "input": "Hello",
    "stream": true
  }'
```

Body request theo OpenAI Responses API (`input`, `instructions`, `tools`, `stream`, …). Client Anthropic Messages gọi `/v1/messages` thay vào:

```bash
curl http://localhost:8080/v1/messages \
  -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "swe-2-max",
    "max_tokens": 256,
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

Xem [hướng dẫn Contributing](CONTRIBUTING.md) để biết chính xác subset trường được hỗ trợ trên từng mặt.

## Cấu hình

Cấu hình là file YAML nạp một lần lúc khởi động. Trường không nhận diện được sẽ bị từ chối.

| Trường                                         | Mô tả                                                                                                                                                                                                                                                                                                                                                                                     | Bắt buộc / Mặc định                                                               |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `server.listen`                                | Địa chỉ HTTP listen                                                                                                                                                                                                                                                                                                                                                                       | Có                                                                                |
| `server.max_concurrency`                       | Số request `/v1/*` đồng thời tối đa                                                                                                                                                                                                                                                                                                                                                       | `1024`                                                                            |
| `devin.base_url`                               | Base URL của Devin Connect service                                                                                                                                                                                                                                                                                                                                                        | Có (code không default; `config.example.yaml` dùng `https://server.codeium.com`)  |
| `devin.accounts`                               | Entry pool tài khoản upstream `{name, token, credentials_file, api_key, priority, max_rpm}` — ít nhất một trong `token`/`credentials_file`/`api_key` (`api_key` = platform key `cog_…` bền, tự đúc session token); `priority` sắp thứ tự chọn lane (0 = mặc định), `max_rpm` ghi đè giới hạn rate theo tài khoản; list rỗng = pool rỗng hợp lệ (quản tài khoản trực tiếp từ `/web/accounts.html`) | Không — `/v1` trả `unavailable` đến khi có tài khoản                              |
| `devin.model`                                  | UID model chat Devin (ví dụ `swe-2-max`)                                                                                                                                                                                                                                                                                                                                                  | Có (code không default)                                                           |
| `devin.aliases`                                | Map tên model phía client → UID upstream (`swe-2: swe-2-max`); thứ tự khớp exact → case-insensitive → `"*"` bắt hết; alias xuất hiện trong `/v1/models` với `alias_of`                                                                                                                                                                                                                     | none                                                                              |
| `devin.client_name`/`client_version`/`client_os` | Client identity gửi trong metadata upstream                                                                                                                                                                                                                                                                                                                                               | `chisel` / `3000.2.17` / `mac`                                                    |
| `devin.proxy`                                  | URL proxy upstream (`http(s)://`, `socks5(h)://`); rỗng = trực tiếp / env vars                                                                                                                                                                                                                                                                                                            | none                                                                              |
| `devin.force_http1`                            | Kết nối TCP riêng mỗi request tới upstream (tránh serialization stream HTTP/2)                                                                                                                                                                                                                                                                                                            | `true`                                                                            |
| `devin.max_rpm`                                | Giới hạn tốc độ message lên upstream (msgs/min, token bucket); `<=0` không giới hạn — chốt 429 cooldown áp dụng bất kể                                                                                                                                                                                                                                                                    | `0` (không giới hạn; `config.example.yaml` đặt `80`)                              |
| `devin.gate_max_hold_seconds`                  | Số giây tối đa một request được xếp ngoài chốt chờ window gửi tiếp theo trước khi fast-fail `429` + `Retry-After` (bên trong chốt request fast-fail thay vì giữ)                                                                                                                                                                                                                          | `30`                                                                              |
| `devin.gate_drip_interval_seconds`             | Chu kỳ nhả probe bên trong chốt — điều phối lưu lượng đến upstream và phát hiện mở chốt khi đang bị giới hạn                                                                                                                                                                                                                                                                                | `8`                                                                               |
| `devin.gate_default_latch_seconds`             | Thời lượng chốt mặc định khi `resource_exhausted` upstream không khai báo thời điểm reset                                                                                                                                                                                                                                                                                                 | `60`                                                                              |
| `devin.gate_window_offset_seconds`             | Vị trí ước lượng của biên bucket phút upstream bên trong phút local (rơi vào giây nào)                                                                                                                                                                                                                                                                                                    | `0` (`:00` local; biên quan sát được là `:59` local)                              |
| `devin.gate_window_guard_seconds`              | Vùng chết hai phía biên bucket ước lượng — request vào đây ngủ đến window kế tiếp                                                                                                                                                                                                                                                                                                         | `2`                                                                               |
| `devin.gate_bg_max_hold_seconds`               | Ngân sách chờ trong gate cho token class `bg` — batch traffic không người trông có thể đợi (fg vẫn dùng `gate_max_hold_seconds`); xem `docs/gate-classes.md`                                                                                                                                                                                                                              | `120`                                                                             |
| `devin.gate_bg_reserve_margin`                 | Biên an toàn cố định (requests) trong công thức reserve cấp phép bg — `reserve` slot cuối mỗi window bg không với tới để fg luôn có headroom                                                                                                                                                                                                                                             | `4`                                                                               |
| `devin.warm_prefix_*`                          | Họ prefix-replay warming — replay prefix session đã giữ theo chu kỳ để gia hạn upstream prompt cache xuyên qua chờ dài của subagent; danh sách key trong `config.example.yaml`, cơ chế trong `docs/upstream-cache.md`                                                                                                                                                                        | `warm_prefix_enabled: false`                                                      |
| `devin.session_affinity_ttl_seconds`           | TTL sliding cho binding session→lane (gia hạn mỗi lần trúng); header `X-Claude-Code-Session-Id`/`X-Session-ID`/`X-Session-Affinity`/`X-Conversation-Id`/`X-Thread-Id` ghim session vào một lane                                                                                                                                                                                           | `3600`                                                                            |
| `devin.quota_low_threshold_percent`            | Ngưỡng phần trăm quota tuần mà dưới đó lane bị hạ sau các lane khoẻ khi nhận session mới (session đã bind không ảnh hưởng)                                                                                                                                                                                                                                                                | `15`                                                                              |
| `devin.no_progress_timeout_seconds`            | Watchdog không-tiến-triển sau khi content đã chảy — upstream có thể im lặng tính tool-call argument 15–25 phút chỉ gửi heartbeat, nên giá trị này phải cao hơn hẳn thế                                                                                                                                                                                                                  | `2700`                                                                            |
| `devin.pre_event_no_progress_timeout_seconds`  | Watchdog không-tiến-triển trước event đầu tiên giải mã được; im lặng pre-event tổng còn bị chặn cứng riêng ở 180s (từ lần gửi đầu, cộng dồn qua các lần mở lại stream) — tăng giá trị này không vượt được mốc đó                                                                                                                                                                        | `600`                                                                             |
| `debug.enabled`                                | Ghi debug payload từng request vào `devin-2api.db` (bảng `debug_files`/`debug_chunks`) trong state dir                                                                                                                                                                                                                                                                                    | `false`                                                                           |
| `debug.retention_days`                         | Số ngày giữ bản ghi debug từng request; `<=0` tắt dọn theo thời gian                                                                                                                                                                                                                                                                                                                      | `14`                                                                              |
| `debug.max_total_mb`                           | Trần tổng debug payload (MB); loại nhóm request cũ nhất trước                                                                                                                                                                                                                                                                                                                             | `1024`                                                                            |
| `debug.payload_hours`                          | Số giờ trước khi tước payload lớn (03/04/06/attachments), giữ lại meta/error                                                                                                                                                                                                                                                                                                              | `24`                                                                              |
| `debug.keep_error_dirs`                        | N nhóm request thất bại gần nhất (có hàng `error.json`) được bảo vệ khỏi đuổi theo dung lượng                                                                                                                                                                                                                                                                                            | `32`                                                                              |
| `debug.errors_only`                            | Chỉ giữ payload cho request thất bại hoặc khả nghi — hoàn thành sạch bị tước payload ngay khi xong (meta/error anchor và hàng `logs` vẫn ở lại); key panel `debug_log_errors_only`, đổi nóng được                                                                                                                                                                                          | `false`                                                                           |
| `debug.quota_interval_minutes`                 | Chu kỳ snapshot quota vào bảng `quota_samples`; `<=0` tắt                                                                                                                                                                                                                                                                                                                                 | `5`                                                                               |
| `debug.pprof_listen`                           | Địa chỉ listen riêng cho endpoint pprof/fgprof (ví dụ `127.0.0.1:6060`); không xác thực — chỉ loopback                                                                                                                                                                                                                                                                                    | rỗng (tắt)                                                                        |
| `dashboard.password`                           | Mật khẩu admin `/web`; rỗng = không cần login                                                                                                                                                                                                                                                                                                                                             | none                                                                              |

```yaml
server:
    listen: ":8080"

devin:
    base_url: "https://server.codeium.com"
    accounts:
        - name: "main"
          token: "devin-session-token$..."
    model: "swe-2-max"

debug:
    enabled: false

dashboard:
    password: "" # /web login; rỗng = mở toang


# Token /v1 downstream chỉ nằm trong panel (/web/tokens.html) — config
# không chứa credential data-plane. Token store rỗng nghĩa là mở toang.
```

Ghi chú:

- token không bao giờ ghi vào logs (đã che thành `<redacted>`);
- chưa có tài khoản nào thì pool rỗng: `/v1` fail fast `unavailable` — thêm tài khoản từ panel (`/web/accounts.html`), hoặc `devin.accounts` + config reload, cả hai đều không cần restart;
- `config.yaml` đã gitignore — vẫn đừng đưa token thật vào git; pre-commit chạy gitleaks để bắt secret lỡ commit.

## Xử lý sự cố

Mọi response `/v1/*` mang header `X-Request-Id` (body lỗi còn mang `debug_ref`) đặt tên bản ghi debug của request đó — `GET /admin/debug-logs/{id}/file/error.json` cho thấy điểm hỏng đầu tiên, và `logs/stderr.log` trong state dir có một dòng tóm tắt mỗi request. Triệu chứng thường gặp:

- **`401`** — không có token khớp trong store (tạo một cái trong `/web/tokens.html`), hoặc upstream từ chối credential của tài khoản; lane resolve lại và retry một lần — kiểm tra trạng thái lane ở `/web/accounts.html`
- **`unavailable`** — pool tài khoản rỗng; thêm tài khoản trong `/web/accounts.html`, hoặc qua `devin.accounts` + config reload
- **`429`** — gate rate cục bộ fast-fail (`Retry-After` cho biết khi nào retry) hoặc upstream đang rate-limit; cột `error_stage` trong bảng `logs` (`rate_gate` vs `devin_connect`) phân biệt hai trường hợp
- **SSE khựng gần ~300s** — đó là timeout tổng của chính client, không phải proxy; stream đã disconnect vẫn chạy tiếp phía server và một retry giống hệt sẽ replay nó từ completion cache

Bảng đầy đủ triệu chứng → tầng → cách sửa nằm trong [`docs/upstream-debug-playbook.md`](docs/upstream-debug-playbook.md)（中文）.

## Tài liệu

- **Hướng dẫn người dùng (cài đặt, client, cấu hình, xử lý sự cố)**: [wncfht.github.io/devin2api](https://wncfht.github.io/devin2api/)
- **Kiến trúc, trường API được hỗ trợ, trích proto và các chi tiết kỹ thuật khác**: [hướng dẫn Contributing](CONTRIBUTING.md)
- **Ghi chú reverse-engineering giao thức upstream, setup client, playbook debug, deploy & toolchain**: [docs/](docs/README.md)（中文）
- **License**: [MIT](LICENSE)

## Lời cảm ơn

Dự án này phát triển trên [leookun/devin-2api](https://github.com/leookun/devin-2api) — cảm ơn các tác giả gốc vì công trình của họ.
