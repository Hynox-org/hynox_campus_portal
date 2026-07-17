# Sandbox Engine

Standalone code-execution service for hynox-campus programming challenges. Every submission
runs inside a locked-down, disposable Docker container: no network access, capped CPU/memory,
a process-count limit (fork-bomb protection), read-only filesystem except a small tmpfs scratch
dir, and a non-root user. This is the only thing standing between arbitrary student-submitted
code and the host machine, so don't relax these flags without understanding why they're there
(see `src/docker-runner.ts`).

This service does not run as part of `next dev`/`next build` — it's a separate always-on
process, same as `src/services/worker.ts`.

## Prerequisites

- Docker Desktop (WSL2 backend on Windows) installed and running — verify with `docker run hello-world`.

## One-time setup: build the language images

```sh
cd sandbox-engine
sh build-images.sh
```

This builds `hynox-sandbox-js`, `hynox-sandbox-ts`, `hynox-sandbox-python`,
`hynox-sandbox-java`, `hynox-sandbox-c`, `hynox-sandbox-cpp`. Re-run this whenever an
`entrypoint-*.sh` or `*.Dockerfile` changes.

## Running the service

```sh
cd sandbox-engine
npm install
npm run dev
```

Listens on `PORT` (default `4000`). Set `SANDBOX_ENGINE_API_KEY` to require an `x-api-key`
header on `/execute` (recommended once this is network-reachable outside localhost) — the
Next.js app must then send the same key via `SANDBOX_ENGINE_API_KEY` in its own `.env.local`.

## API

`POST /execute`
```json
{
  "language": "python",
  "sourceCode": "print(input())",
  "stdin": "hello\n",
  "timeLimitMs": 2000,
  "memoryLimitMb": 256
}
```
Returns `{ stdout, stderr, status, executionTimeMs, memoryUsedKb }` where `status` is one of
`success | compile_error | runtime_error | timeout | memory_limit_exceeded`.

## Adding a language

1. Add an `entrypoint-<lang>.sh` following the existing exit-code convention (0 success,
   100 compile error, everything else runtime — `timeout` already yields 124 for TLE).
2. Add a `<lang>.Dockerfile` based on the smallest reasonable official image for that
   toolchain, non-root user, `coreutils` installed if the base is Alpine (for GNU `timeout`).
3. Register it in `LANGUAGE_CONFIG` in `src/docker-runner.ts` and rebuild images.
