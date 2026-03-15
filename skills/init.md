# Initialize Project — Dispatcher

Routes to the correct framework-specific init skill.

## Arguments

$ARGUMENTS: `<framework>`

| Argument | Skill to invoke | Architecture |
|---|---|---|
| `nextjs` (default for web) | Follow `/web-init` instructions | Next.js App Router, feature auto-discovery |
| `flutter` | Follow `/flutter-init` instructions | GoRouter + Riverpod, feature registry |
| `fastapi` | Follow `/init-fastapi` instructions | FastAPI, module auto-discovery |
| `python-grpc` | Follow `/init-python-grpc` instructions | grpcio, module auto-discovery |
| `go-grpc` (default for backend) | Follow `/init-go-grpc` instructions | Go gRPC, init() self-registration |
| `rust-grpc` | Follow `/init-rust-grpc` instructions | Rust tonic, inventory self-registration |

## Steps

1. Parse $ARGUMENTS to determine the framework
2. Read the corresponding skill file from `~/.claude/commands/` and follow its instructions exactly
3. If no argument provided, ask the user what they're building

## Aliases

Common shorthand:
- `web` → `nextjs`
- `api` → `fastapi`
- `grpc` → `go-grpc`
- `mobile` → `flutter`
