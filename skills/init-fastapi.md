# Scaffold — Python FastAPI (Append-Only Module Architecture)

Set up a FastAPI service where adding a feature = adding a directory under `modules/`. Core is frozen. Modules self-register via directory scanning.

## Arguments

$ARGUMENTS: optional project name.

## Architecture

```
core/                               ← FROZEN after scaffold
  __init__.py
  server.py                         ← FastAPI app, auto-discovers modules
  registry.py                       ← scans modules/ dir, imports routers
  bus.py                            ← async event bus (publish/subscribe)
  store.py                          ← SQLAlchemy async session factory
  config.py                         ← pydantic BaseSettings
  deps.py                           ← FastAPI dependency injection (db session, current user)
modules/                            ← APPEND-ONLY — each module is a directory
  health/
    __init__.py
    router.py                       ← APIRouter with /health endpoint
    schemas.py                      ← pydantic models (if not using proto)
  invoice/                          ← Agent A adds this entire dir
    __init__.py
    router.py                       ← APIRouter, auto-registered by core
    service.py                      ← business logic
    models.py                       ← SQLAlchemy models (this module's tables)
    schemas.py                      ← request/response pydantic models
    events.py                       ← events this module publishes
    subscribers.py                  ← events this module subscribes to
    tests/
      test_router.py
      test_service.py
  payment/                          ← Agent B adds this — zero conflict
    ...
gen/
  python/                           ← GENERATED from proto — never hand-edit
main.py                             ← FROZEN — uvicorn entry point
```

### Zero-modification auto-discovery

The core scans `modules/*/router.py` at startup. No imports to add, no registry to append. Just create a directory and it appears.

## Steps

### 1. Initialize

Create `pyproject.toml`:
```toml
[project]
name = "<project>"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "sqlalchemy[asyncio]>=2.0",
    "asyncpg>=0.30",
    "pydantic-settings>=2.0",
    "httpx>=0.27",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.23",
    "httpx>=0.27",
    "ruff>=0.5",
]
```

```bash
uv sync
```

### 2. Core — `core/registry.py` (FROZEN)

```python
"""
Auto-discovers modules by scanning the modules/ directory.
Any directory under modules/ with a router.py is auto-registered.
No hardcoded list. No imports to maintain. Just add a directory.
"""
import importlib
import pkgutil
from pathlib import Path
from fastapi import APIRouter, FastAPI


def discover_modules(app: FastAPI) -> None:
    modules_dir = Path(__file__).parent.parent / "modules"

    for item in sorted(modules_dir.iterdir()):
        if not item.is_dir() or item.name.startswith("_"):
            continue

        router_path = item / "router.py"
        if not router_path.exists():
            continue

        module = importlib.import_module(f"modules.{item.name}.router")
        router: APIRouter = getattr(module, "router", None)

        if router is not None:
            prefix = getattr(module, "PREFIX", f"/{item.name}")
            app.include_router(router, prefix=prefix)

        # Auto-register event subscribers
        subscribers_path = item / "subscribers.py"
        if subscribers_path.exists():
            importlib.import_module(f"modules.{item.name}.subscribers")
```

### 3. Core — `core/bus.py` (FROZEN)

```python
"""
Async event bus for inter-module communication.
Modules publish events, other modules subscribe.
They never import each other directly.
"""
import asyncio
from dataclasses import dataclass, field
from typing import Any, Callable, Awaitable
from collections import defaultdict


@dataclass
class Event:
    type: str
    payload: dict[str, Any] = field(default_factory=dict)


EventHandler = Callable[[Event], Awaitable[None]]


class EventBus:
    def __init__(self):
        self._handlers: dict[str, list[EventHandler]] = defaultdict(list)

    def subscribe(self, event_type: str, handler: EventHandler) -> None:
        self._handlers[event_type].append(handler)

    async def publish(self, event: Event) -> None:
        for handler in self._handlers.get(event.type, []):
            await handler(event)


# Singleton — modules import this instance
bus = EventBus()
```

### 4. Core — `core/store.py` (FROZEN)

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from core.config import settings

engine = create_async_engine(settings.database_url)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
```

### 5. Core — `core/config.py` (FROZEN)

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/app"
    port: int = 8080
    debug: bool = False

settings = Settings()
```

### 6. Core — `core/deps.py` (FROZEN)

```python
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from core.store import async_session

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session
```

### 7. Core — `core/server.py` (FROZEN)

```python
from fastapi import FastAPI
from core.registry import discover_modules

def create_app() -> FastAPI:
    app = FastAPI(title="API")
    discover_modules(app)  # auto-discovers all modules
    return app
```

### 8. Entry point — `main.py` (FROZEN)

```python
import uvicorn
from core.server import create_app
from core.config import settings

app = create_app()

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=settings.port, reload=settings.debug)
```

### 9. Health module — `modules/health/router.py`

```python
from fastapi import APIRouter

PREFIX = ""  # mounted at root, not /health/health
router = APIRouter()

@router.get("/health")
async def health():
    return {"status": "ok"}
```

### 10. How agents add a module (the template)

To add an "invoice" module, an agent creates:

```
modules/invoice/
  __init__.py           ← empty
  router.py             ← APIRouter with endpoints
  service.py            ← business logic (uses gen/python types if proto)
  models.py             ← SQLAlchemy models for invoice tables
  schemas.py            ← pydantic request/response models
  events.py             ← InvoiceCreated, InvoicePaid event definitions
  subscribers.py        ← subscribes to events from other modules
  tests/
    test_router.py
    test_service.py
```

`modules/invoice/router.py`:
```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from core.deps import get_db
from . import service, schemas

router = APIRouter(tags=["invoices"])

@router.get("/", response_model=list[schemas.Invoice])
async def list_invoices(db: AsyncSession = Depends(get_db)):
    return await service.list_invoices(db)

@router.post("/", response_model=schemas.Invoice, status_code=201)
async def create_invoice(data: schemas.CreateInvoice, db: AsyncSession = Depends(get_db)):
    invoice = await service.create_invoice(db, data)
    # Publish event — other modules can react without coupling
    from core.bus import bus, Event
    await bus.publish(Event(type="invoice.created", payload={"id": str(invoice.id)}))
    return invoice
```

That's it. Core discovers it automatically. No files modified.

### 11. Dockerfile, docker-compose.yml, CI, Makefile

Standard Python setup. Dockerfile with `python:3.12-slim`. docker-compose with postgres. Makefile with `test`, `lint`, `run`, `docker-build`.

### 12. Report

Explain:
- Core is frozen — never modify anything in `core/`
- Add modules by creating directories under `modules/`
- Modules auto-register — core scans the directory at startup
- Inter-module communication is via event bus only
- Agents on different modules = zero conflict
