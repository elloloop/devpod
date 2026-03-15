# Scaffold — Python gRPC (Append-Only Module Architecture)

Set up a Python gRPC service where adding a feature = adding a directory under `modules/`. Core is frozen. Modules self-register via directory scanning.

## Architecture

```
core/                               ← FROZEN after scaffold
  __init__.py
  server.py                         ← gRPC server, auto-discovers servicers
  registry.py                       ← scans modules/, registers servicers
  bus.py                            ← async event bus
  store.py                          ← SQLAlchemy async session
  config.py                         ← pydantic settings
modules/                            ← APPEND-ONLY
  health/
    __init__.py
    servicer.py                     ← HealthServicer implementation
  invoice/                          ← Agent A adds this
    __init__.py
    servicer.py                     ← InvoiceServiceServicer (implements gen/ stub)
    service.py                      ← business logic
    models.py                       ← SQLAlchemy models
    events.py                       ← event definitions
    subscribers.py                  ← event subscriptions
    tests/
gen/
  python/                           ← GENERATED from proto — never hand-edit
    invoice_pb2.py
    invoice_pb2_grpc.py
proto/
  invoice.proto
```

## Steps

### 1. Initialize

```toml
[project]
name = "<project>"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "grpcio>=1.65",
    "grpcio-reflection>=1.65",
    "grpcio-health-checking>=1.65",
    "protobuf>=5.0",
    "sqlalchemy[asyncio]>=2.0",
    "asyncpg>=0.30",
    "pydantic-settings>=2.0",
]

[project.optional-dependencies]
dev = [
    "grpcio-tools>=1.65",
    "pytest>=8.0",
    "pytest-asyncio>=0.23",
    "ruff>=0.5",
]
```

### 2. Core — `core/registry.py` (FROZEN)

```python
"""
Auto-discovers gRPC servicers from modules/ directory.
Any module with a servicer.py that has a 'register' function gets auto-registered.
"""
import importlib
from pathlib import Path
import grpc


def discover_servicers(server: grpc.aio.Server) -> None:
    modules_dir = Path(__file__).parent.parent / "modules"

    for item in sorted(modules_dir.iterdir()):
        if not item.is_dir() or item.name.startswith("_"):
            continue

        servicer_path = item / "servicer.py"
        if not servicer_path.exists():
            continue

        module = importlib.import_module(f"modules.{item.name}.servicer")

        # Each servicer module must have a register(server) function
        register_fn = getattr(module, "register", None)
        if register_fn is not None:
            register_fn(server)

        # Auto-register event subscribers
        subscribers_path = item / "subscribers.py"
        if subscribers_path.exists():
            importlib.import_module(f"modules.{item.name}.subscribers")
```

### 3. Core — `core/server.py` (FROZEN)

```python
import asyncio
import grpc
from grpc_health.v1 import health_pb2_grpc
from grpc_health.v1.health import HealthServicer
from grpc_reflection.v1alpha import reflection
from core.registry import discover_servicers
from core.config import settings


async def serve() -> None:
    server = grpc.aio.server()

    # Built-in health check
    health_servicer = HealthServicer()
    health_pb2_grpc.add_HealthServicer_to_server(health_servicer, server)

    # Auto-discover and register all module servicers
    discover_servicers(server)

    # Enable reflection (for grpcurl, debugging)
    service_names = [s.full_name for s in server._state.generic_handlers]
    reflection.enable_server_reflection(
        [*service_names, reflection.SERVICE_NAME], server
    )

    server.add_insecure_port(f"[::]:{settings.port}")
    await server.start()
    print(f"gRPC server listening on :{settings.port}")
    await server.wait_for_termination()
```

### 4. Core — `core/bus.py` (FROZEN)

Same event bus as FastAPI version — asyncio-based publish/subscribe.

### 5. Entry point — `main.py` (FROZEN)

```python
import asyncio
from core.server import serve

if __name__ == "__main__":
    asyncio.run(serve())
```

### 6. Health module — `modules/health/servicer.py`

```python
import grpc
from grpc_health.v1 import health_pb2, health_pb2_grpc


def register(server: grpc.aio.Server) -> None:
    # Health is registered by core/server.py directly
    # This module exists as a pattern example
    pass
```

### 7. How agents add a module (the template)

To add an "invoice" module, an agent creates:

```
modules/invoice/
  __init__.py
  servicer.py           ← implements InvoiceServiceServicer from gen/
  service.py            ← business logic
  models.py             ← SQLAlchemy models
  events.py             ← event definitions
  subscribers.py        ← event subscriptions
  tests/
```

`modules/invoice/servicer.py`:
```python
import grpc
from gen.python import invoice_pb2, invoice_pb2_grpc
from . import service


class InvoiceServiceServicer(invoice_pb2_grpc.InvoiceServiceServicer):
    async def CreateInvoice(self, request, context):
        result = await service.create_invoice(request)
        # Publish event
        from core.bus import bus, Event
        await bus.publish(Event(type="invoice.created", payload={"id": result.id}))
        return result

    async def GetInvoice(self, request, context):
        result = await service.get_invoice(request.id)
        if result is None:
            context.abort(grpc.StatusCode.NOT_FOUND, "Invoice not found")
        return result

    async def ListInvoices(self, request, context):
        return await service.list_invoices(request)


def register(server: grpc.aio.Server) -> None:
    invoice_pb2_grpc.add_InvoiceServiceServicer_to_server(
        InvoiceServiceServicer(), server
    )
```

Core discovers it automatically. No files modified.

### 8. Dockerfile, docker-compose, CI, Makefile

Standard Python gRPC setup. Health check via `grpc_health_probe`. Makefile with `proto`, `test`, `lint`, `run`.

### 9. Report

Same as FastAPI — core frozen, modules append-only, auto-discovered, event bus for cross-module comms.
