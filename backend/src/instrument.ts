// Loaded first by index.ts. Sentry must initialize before express, http and pg are required so its
// OpenTelemetry instrumentation can patch them; otherwise errors still reach Sentry through the
// error handler, but request tracing records nothing. The build is CommonJS, so import order is
// load order.
import 'dotenv/config';
import { initBackendErrorTracking } from './core/errorTracking';

initBackendErrorTracking();
