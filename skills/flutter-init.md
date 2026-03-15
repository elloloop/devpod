# Scaffold — Flutter (Append-Only Feature Architecture)

Set up a Flutter app where adding a feature = adding a directory. Core shell is frozen after scaffold.

## Arguments

$ARGUMENTS: platform targets. Default: `all`.
- `/flutter-init` → all platforms
- `/flutter-init mobile`
- `/flutter-init web`

## Architecture

```
lib/
  main.dart                         ← FROZEN — entry point, calls App
  core/                             ← FROZEN after scaffold
    app.dart                        ← MaterialApp.router with GoRouter
    router.dart                     ← collects routes from all features via registry
    registry.dart                   ← feature manifest list (one append per feature)
    theme.dart                      ← app theme
    providers/                      ← shared Riverpod providers
      auth_provider.dart
      api_provider.dart             ← Dio client configured for backend
    widgets/                        ← shared widgets
      app_shell.dart                ← scaffold with auto-nav from registry
      loading.dart
      error_view.dart
  features/                         ← APPEND-ONLY — each feature is a directory
    home/
      feature.dart                  ← FeatureManifest (routes, nav label, icon)
      screens/
        home_screen.dart
      widgets/
      providers/                    ← feature-scoped Riverpod providers
    invoice/                        ← Agent A adds this entire dir
      feature.dart
      screens/
        invoice_list_screen.dart
        invoice_detail_screen.dart
      widgets/
        invoice_card.dart
      providers/
        invoice_provider.dart       ← uses gen/dart types
  gen/
    dart/                           ← GENERATED from proto — never hand-edit
test/
  widget/
integration_test/
```

## Steps

### 1. Initialize

```bash
flutter create . --org com.elloloop --platforms <platforms>
```

### 2. Add dependencies

```bash
flutter pub add go_router
flutter pub add flutter_riverpod riverpod
flutter pub add dio
flutter pub add freezed_annotation json_annotation
flutter pub add --dev freezed json_serializable build_runner
flutter pub add --dev mocktail
```

### 3. Feature registry — `lib/core/registry.dart`

```dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

// Every feature exports one of these from its feature.dart
class FeatureManifest {
  final String name;
  final String basePath;
  final String? navLabel;
  final IconData? navIcon;
  final int order;
  final List<RouteBase> routes;

  const FeatureManifest({
    required this.name,
    required this.basePath,
    required this.routes,
    this.navLabel,
    this.navIcon,
    this.order = 99,
  });
}

// ──────────────────────────────────────────────────────────────
// FEATURE REGISTRY — the ONLY append point in the entire codebase.
// When an agent adds a feature, it adds ONE import + ONE entry here.
// ──────────────────────────────────────────────────────────────
import '../features/home/feature.dart';
// import '../features/invoice/feature.dart';    ← agent appends this
// import '../features/payment/feature.dart';    ← another agent appends this

final List<FeatureManifest> features = [
  homeFeature,
  // invoiceFeature,    ← agent appends this
  // paymentFeature,    ← another agent appends this
]..sort((a, b) => a.order.compareTo(b.order));
```

### 4. Router — `lib/core/router.dart` (FROZEN)

```dart
import 'package:go_router/go_router.dart';
import 'registry.dart';
import '../core/widgets/app_shell.dart';

final router = GoRouter(
  initialLocation: '/',
  routes: [
    ShellRoute(
      builder: (context, state, child) => AppShell(child: child),
      routes: [
        // Auto-collect routes from all registered features
        for (final feature in features)
          ...feature.routes,
      ],
    ),
  ],
);
```

### 5. App shell — `lib/core/widgets/app_shell.dart` (FROZEN)

```dart
import 'package:flutter/material.dart';
import '../registry.dart';
import 'package:go_router/go_router.dart';

class AppShell extends StatelessWidget {
  final Widget child;
  const AppShell({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    // Build nav items from feature registry — auto-discovers features
    final navFeatures = features.where((f) => f.navLabel != null).toList();

    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex(context, navFeatures),
        onDestinationSelected: (i) =>
            GoRouter.of(context).go(navFeatures[i].basePath),
        destinations: [
          for (final f in navFeatures)
            NavigationDestination(
              icon: Icon(f.navIcon ?? Icons.circle),
              label: f.navLabel!,
            ),
        ],
      ),
    );
  }

  int _currentIndex(BuildContext context, List<FeatureManifest> navFeatures) {
    final location = GoRouterState.of(context).uri.toString();
    final idx = navFeatures.indexWhere((f) => location.startsWith(f.basePath));
    return idx >= 0 ? idx : 0;
  }
}
```

### 6. App — `lib/core/app.dart` (FROZEN)

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'router.dart';
import 'theme.dart';

class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    return ProviderScope(
      child: MaterialApp.router(
        title: 'App',
        theme: appTheme,
        routerConfig: router,
      ),
    );
  }
}
```

### 7. API provider — `lib/core/providers/api_provider.dart` (FROZEN)

```dart
import 'package:dio/dio.dart';
import 'package:riverpod/riverpod.dart';

final dioProvider = Provider<Dio>((ref) {
  return Dio(BaseOptions(
    baseUrl: const String.fromEnvironment('API_URL', defaultValue: 'http://localhost:8080'),
    connectTimeout: const Duration(seconds: 10),
  ));
});
```

### 8. Home feature — `lib/features/home/feature.dart`

```dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/registry.dart';
import 'screens/home_screen.dart';

final homeFeature = FeatureManifest(
  name: 'home',
  basePath: '/',
  navLabel: 'Home',
  navIcon: Icons.home,
  order: 0,
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const HomeScreen(),
    ),
  ],
);
```

### 9. How agents add a feature (the template)

To add an "invoice" feature, an agent:

1. Creates `lib/features/invoice/`:
```
feature.dart           ← FeatureManifest with routes, nav label
screens/
  invoice_list_screen.dart
  invoice_detail_screen.dart
widgets/
  invoice_card.dart
providers/
  invoice_provider.dart   ← uses gen/dart/ proto types
```

2. Adds ONE import + ONE entry to `lib/core/registry.dart`:
```dart
import '../features/invoice/feature.dart';
// ... and add invoiceFeature to the features list
```

That's it. Nav updates automatically.

### 10. Main — `lib/main.dart` (FROZEN)

```dart
import 'package:flutter/material.dart';
import 'core/app.dart';

void main() {
  runApp(const App());
}
```

### 11. Tests

Widget test for HomeScreen. Integration test scaffold.

### 12. CI, Makefile, analysis_options.yaml

Standard Flutter CI. Makefile with test, analyze, build targets.

### 13. Report

Explain:
- Core is frozen — never modify `lib/core/`
- Add features under `lib/features/` + one append to registry
- Features never import from each other — only from `core/` and `gen/dart/`
- Different agents on different features = zero conflict
