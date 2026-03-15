# Define Proto Contract

Define the proto contract for a feature. This is always done FIRST before any backend or frontend work. The proto is the single source of truth — all components generate code from it.

After defining the contract, this skill propagates the full contract spec to every component sub-issue so each one knows exactly what to implement.

## Arguments

$ARGUMENTS: optional service name.
- `/contract` → infer from issue title
- `/contract UserService`

## Steps

### 1. Read context

- Read issue from `.claude/issue`
- `gh issue view <number>` to understand what needs to be built
- Check if `proto/` directory exists already
- Check if `buf.yaml` exists

### 2. Set up Buf (if not already)

If `buf.yaml` doesn't exist:

```yaml
# buf.yaml
version: v2
lint:
  use:
    - STANDARD
breaking:
  use:
    - FILE
```

```yaml
# buf.gen.yaml
version: v2
plugins:
  # Go
  - remote: buf.build/protocolbuffers/go
    out: gen/go
    opt: paths=source_relative
  - remote: buf.build/grpc/go
    out: gen/go
    opt: paths=source_relative

  # Python
  - remote: buf.build/protocolbuffers/python
    out: gen/python
  - remote: buf.build/grpc/python
    out: gen/python

  # TypeScript (Connect for web)
  - remote: buf.build/connectrpc/es
    out: gen/ts
    opt: target=ts
  - remote: buf.build/bufbuild/es
    out: gen/ts
    opt: target=ts

  # Dart (for Flutter)
  - remote: buf.build/protocolbuffers/dart
    out: gen/dart
```

Adjust `buf.gen.yaml` based on which components exist in the project (check for `go.mod`, `package.json`, `pubspec.yaml`, `Cargo.toml`). Only include plugins for languages actually used in the project.

### 3. Define the proto

Create or update `proto/<service_name>.proto`:

```protobuf
syntax = "proto3";

package <project>.<service>;

option go_package = "<module>/gen/go/<service>";

// Health check (standard in every service)
service Health {
  rpc Check(HealthCheckRequest) returns (HealthCheckResponse);
}

message HealthCheckRequest {}
message HealthCheckResponse {
  enum ServingStatus {
    UNKNOWN = 0;
    SERVING = 1;
    NOT_SERVING = 2;
  }
  ServingStatus status = 1;
}

// The actual service
service <ServiceName> {
  // Define RPCs based on the issue requirements
}

// Request/Response messages
// Define based on the issue requirements
```

Design the proto based on the issue description:
- Use clear, descriptive message and field names
- Follow proto3 best practices (no required fields, use wrappers for nullable)
- Include comments explaining each RPC and message
- Think about pagination for list endpoints
- Think about field masks for update endpoints

### 4. Lint

```bash
buf lint
```

Fix any issues.

### 5. Check for breaking changes (if proto existed before)

```bash
buf breaking --against '.git#branch=main'
```

If breaking changes detected, discuss with user before proceeding.

### 6. Generate code

```bash
buf generate
```

This creates generated types in `gen/` for each configured language.

### 7. Commit the contract

```bash
git add proto/ buf.yaml buf.gen.yaml gen/
git commit -m "Define <ServiceName> proto contract"
```

### 8. Build the contract spec

Before updating any issues, build a complete human-readable contract spec. This is the key artifact that gets propagated. Include:

```
### Contract: <ServiceName>

**Proto file**: `proto/<service_name>.proto`

#### RPCs

| RPC | Request | Response | Description |
|---|---|---|---|
| CreateFoo | CreateFooRequest | CreateFooResponse | Creates a new foo |
| GetFoo | GetFooRequest | Foo | Gets a foo by ID |
| ListFoos | ListFoosRequest | ListFoosResponse | Lists foos with pagination |

#### Messages

\`\`\`protobuf
<paste the full proto file content here>
\`\`\`

#### Generated code locations

| Language | Path | Usage |
|---|---|---|
| Go | `gen/go/<service>/` | Import and implement server interface |
| TypeScript | `gen/ts/<service>/` | Import client types for frontend |
| Python | `gen/python/<service>/` | Import and implement server |
| Dart | `gen/dart/<service>/` | Import client types for Flutter |
```

### 9. Update contract issue

Post the contract spec as a comment on the current (contract) issue.

### 10. Propagate contract to component sub-issues

This is critical. The contract must reach every component issue so agents can work independently.

**Find component sub-issues:**
- Read the parent issue number from the current issue body (`Parent: #<number>`)
- Read the parent issue: `gh issue view <parent>`
- Parse the parent's comments to find the split tracking table (from `/split`)
- Extract all component sub-issue numbers from that table

**Update each component sub-issue** with the full contract:

```bash
gh issue comment <component-issue> --body "### 📜 Contract Ready

The proto contract has been defined and generated code is available. Implement against the generated types — never hand-write types the proto defines.

<full contract spec from step 8>

#### For this component

**What to implement**: <specific guidance based on component type>
- **Backend**: Implement the server interface. All RPC handlers in the generated service interface must be implemented. Generated server stub is at \`gen/go/<service>/\` (or python/rust equivalent).
- **Web**: Use the generated TypeScript client to call the service. Client types are at \`gen/ts/<service>/\`.
- **Flutter**: Use the generated Dart client. Client types are at \`gen/dart/<service>/\`.

**How to start**:
1. Pull latest main (contract is committed there)
2. Check \`gen/\` directory for your language's generated code
3. Import the generated types and implement/consume them

_Contract defined at $(date -u +%Y-%m-%dT%H:%M:%SZ)_"
```

Tailor the "For this component" section based on what the component is (look at the sub-issue title for `[Backend]`, `[Web]`, `[Flutter]`, `[Worker]`).

### 11. Update parent issue

```bash
gh issue comment <parent> --body "### 📜 Contract defined

Contract for \`<ServiceName>\` is ready. Component sub-issues have been updated with the full contract spec.

RPCs: <list RPC names>

Components can now be built in parallel."
```

### 12. Report

Show the proto definition. Tell user the contract is ready and has been propagated to all component issues. Suggest:
- Create a PR for the contract: `/pr`
- After merge, start components: `/backend-ship`, `/web-ship`, `/flutter-ship`

## Important
- The proto IS the API design. Take time to get it right.
- Always lint with buf before generating
- Generated code goes in `gen/` — never hand-edit generated files
- The contract spec MUST be propagated to every component sub-issue
- If the proto changes later, re-run `/contract` to regenerate AND re-propagate
- Consider using Connect protocol (connectrpc.com) for web — it gives you both gRPC and HTTP/JSON from the same proto
