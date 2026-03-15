# Scaffold — Go gRPC (Append-Only Module Architecture)

Set up a Go gRPC service where adding a feature = adding a directory under `modules/`. Core is frozen. Modules self-register via `init()`.

## Architecture

```
cmd/
  server/
    main.go                         ← FROZEN — imports modules via blank imports
core/                               ← FROZEN after scaffold
  server.go                         ← gRPC server setup, registers all modules
  registry.go                       ← Module interface + RegisterModule()
  bus.go                            ← event bus (publish/subscribe)
  store.go                          ← database interface (pgx pool)
  config.go                         ← env-based config
modules/                            ← APPEND-ONLY
  health/
    module.go                       ← self-registers via init()
  invoice/                          ← Agent A adds this
    module.go                       ← init() calls core.RegisterModule()
    handler.go                      ← implements InvoiceServiceServer from gen/
    service.go                      ← business logic
    store.go                        ← database queries (this module's tables)
    events.go                       ← event type constants
    subscriber.go                   ← subscribes to events from other modules
    handler_test.go
    service_test.go
gen/
  go/                               ← GENERATED from proto — never hand-edit
    invoice/
      invoice.pb.go
      invoice_grpc.pb.go
proto/
  invoice.proto
```

### Self-registration via init()

Go's `init()` runs automatically when a package is imported. Each module registers itself — the core never has a hardcoded list. The ONLY file that needs a one-line append is `cmd/server/main.go` (a blank import).

## Steps

### 1. Initialize

```bash
go mod init <module-path>
go get google.golang.org/grpc
go get google.golang.org/protobuf
go get github.com/jackc/pgx/v5
```

### 2. Core — `core/registry.go` (FROZEN)

```go
package core

import "google.golang.org/grpc"

// Module is implemented by every feature module.
// Modules self-register by calling RegisterModule in their init().
type Module interface {
	Name() string
	RegisterGRPC(srv *grpc.Server)
	RegisterSubscribers(bus *EventBus)
}

var registeredModules []Module

// RegisterModule is called from each module's init() function.
// The core never maintains a list — modules add themselves.
func RegisterModule(m Module) {
	registeredModules = append(registeredModules, m)
}

// Modules returns all registered modules.
func Modules() []Module {
	return registeredModules
}
```

### 3. Core — `core/server.go` (FROZEN)

```go
package core

import (
	"fmt"
	"log/slog"
	"net"

	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/reflection"
)

type Server struct {
	grpcServer *grpc.Server
	cfg        Config
	bus        *EventBus
}

func NewServer(cfg Config) *Server {
	return &Server{
		grpcServer: grpc.NewServer(),
		cfg:        cfg,
		bus:        NewEventBus(),
	}
}

func (s *Server) Start() error {
	// Register health service
	healthSrv := health.NewServer()
	healthpb.RegisterHealthServer(s.grpcServer, healthSrv)

	// Auto-register all modules
	for _, m := range Modules() {
		slog.Info("registering module", "name", m.Name())
		m.RegisterGRPC(s.grpcServer)
		m.RegisterSubscribers(s.bus)
		healthSrv.SetServingStatus(m.Name(), healthpb.HealthCheckResponse_SERVING)
	}

	// Enable reflection
	reflection.Register(s.grpcServer)

	lis, err := net.Listen("tcp", fmt.Sprintf(":%d", s.cfg.Port))
	if err != nil {
		return err
	}

	slog.Info("gRPC server listening", "port", s.cfg.Port)
	return s.grpcServer.Serve(lis)
}

func (s *Server) Bus() *EventBus { return s.bus }
```

### 4. Core — `core/bus.go` (FROZEN)

```go
package core

import (
	"log/slog"
	"sync"
)

type Event struct {
	Type    string
	Payload map[string]any
}

type EventHandler func(Event) error

type EventBus struct {
	mu       sync.RWMutex
	handlers map[string][]EventHandler
}

func NewEventBus() *EventBus {
	return &EventBus{handlers: make(map[string][]EventHandler)}
}

func (b *EventBus) Subscribe(eventType string, handler EventHandler) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.handlers[eventType] = append(b.handlers[eventType], handler)
}

func (b *EventBus) Publish(e Event) {
	b.mu.RLock()
	handlers := b.handlers[e.Type]
	b.mu.RUnlock()

	for _, h := range handlers {
		if err := h(e); err != nil {
			slog.Error("event handler failed", "event", e.Type, "error", err)
		}
	}
}
```

### 5. Core — `core/store.go` (FROZEN)

```go
package core

import (
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	Pool *pgxpool.Pool
}

func NewStore(ctx context.Context, dsn string) (*Store, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, err
	}
	return &Store{Pool: pool}, nil
}
```

### 6. Core — `core/config.go` (FROZEN)

```go
package core

import "os"

type Config struct {
	Port    int
	DBUrl   string
}

func LoadConfig() Config {
	port := 50051
	return Config{
		Port:  port,
		DBUrl: getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/app?sslmode=disable"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
```

### 7. Entry point — `cmd/server/main.go`

```go
package main

import (
	"log"
	"<module>/core"

	// ── Module blank imports ─────────────────────────────────
	// Each module self-registers via init(). Add one line per module.
	_ "<module>/modules/health"
	// _ "<module>/modules/invoice"   ← agent appends this line
	// _ "<module>/modules/payment"   ← another agent appends this line
)

func main() {
	cfg := core.LoadConfig()
	srv := core.NewServer(cfg)
	if err := srv.Start(); err != nil {
		log.Fatal(err)
	}
}
```

This is the ONE file that gets a one-line append per module. It's an import, not logic — trivially mergeable.

### 8. Health module — `modules/health/module.go`

```go
package health

import (
	"<module>/core"
	"google.golang.org/grpc"
)

func init() {
	core.RegisterModule(&Module{})
}

type Module struct{}

func (m *Module) Name() string { return "health" }
func (m *Module) RegisterGRPC(srv *grpc.Server) {
	// Health is registered by core/server.go, this is a pattern example
}
func (m *Module) RegisterSubscribers(bus *core.EventBus) {}
```

### 9. How agents add a module (the template)

To add an "invoice" module:

1. Create `modules/invoice/`:

`modules/invoice/module.go`:
```go
package invoice

import (
	"<module>/core"
	"<module>/gen/go/invoice"
	"google.golang.org/grpc"
)

func init() {
	core.RegisterModule(&Module{})
}

type Module struct{}

func (m *Module) Name() string { return "invoice" }

func (m *Module) RegisterGRPC(srv *grpc.Server) {
	invoice.RegisterInvoiceServiceServer(srv, &Handler{})
}

func (m *Module) RegisterSubscribers(bus *core.EventBus) {
	// Subscribe to events from other modules if needed
	// bus.Subscribe("payment.completed", m.handlePaymentCompleted)
}
```

`modules/invoice/handler.go`:
```go
package invoice

import (
	"context"
	pb "<module>/gen/go/invoice"
)

type Handler struct {
	pb.UnimplementedInvoiceServiceServer
}

func (h *Handler) CreateInvoice(ctx context.Context, req *pb.CreateInvoiceRequest) (*pb.Invoice, error) {
	// implement using service.go
}
```

2. Add ONE blank import to `cmd/server/main.go`:
```go
_ "<module>/modules/invoice"
```

### 10. Dockerfile, docker-compose, CI, Makefile

Go multi-stage: `golang:1.23-alpine` build, `alpine:3.20` run. Health check via `grpc_health_probe`. Makefile: `proto`, `build`, `test`, `run`.

### 11. Report

Core frozen, modules append-only, self-register via init(), event bus for cross-module.
