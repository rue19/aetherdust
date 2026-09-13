import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface Metric {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram';
  value: number;
  labels?: Record<string, string>;
}

const counters = new Map<string, number>();
const gauges = new Map<string, number>();
const histograms = new Map<string, number[]>();

function incCounter(name: string, labels?: Record<string, string>) {
  const key = labels ? `${name}:${JSON.stringify(labels)}` : name;
  counters.set(key, (counters.get(key) ?? 0) + 1);
}

function setGauge(name: string, value: number) {
  gauges.set(name, value);
}

function observeHistogram(name: string, value: number) {
  const arr = histograms.get(name) ?? [];
  arr.push(value);
  histograms.set(name, arr);
}

function renderMetrics(): string {
  const lines: string[] = [];

  for (const [key, value] of counters) {
    const [name, labelsStr] = key.split(/:(.+)/);
    const labels = labelsStr ? JSON.parse(labelsStr) : {};
    const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',');
    lines.push(`# TYPE ${name} counter`);
    lines.push(`${name}{${labelStr}} ${value}`);
  }

  for (const [name, value] of gauges) {
    lines.push(`# TYPE ${name} gauge`);
    lines.push(`${name} ${value}`);
  }

  for (const [name, values] of histograms) {
    lines.push(`# TYPE ${name} histogram`);
    const sorted = [...values].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0;
    lines.push(`${name}_count ${values.length}`);
    lines.push(`${name}_sum ${values.reduce((a, b) => a + b, 0)}`);
    lines.push(`${name}{quantile="0.5"} ${p50}`);
    lines.push(`${name}{quantile="0.99"} ${p99}`);
  }

  return lines.join('\n') + '\n';
}

export async function metricsPlugin(app: FastifyInstance): Promise<void> {
  const startTime = Date.now();

  app.addHook('onResponse', async (request, reply) => {
    const duration = (Date.now() - (request as any)._startTime) / 1000;
    incCounter('http_requests_total', { method: request.method, status: String(reply.statusCode), path: request.routeOptions?.url ?? request.url });
    observeHistogram('http_request_duration_seconds', duration);
  });

  app.addHook('onRequest', async (request) => {
    (request as any)._startTime = Date.now();
  });

  app.get('/metrics', async (_request, reply) => {
    const metricsKey = process.env.METRICS_API_KEY;
    if (metricsKey) {
      const authHeader = _request.headers.authorization;
      if (!authHeader || authHeader !== `Bearer ${metricsKey}`) {
        return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Valid METRICS_API_KEY required' });
      }
    }
    setGauge('uptime_seconds', (Date.now() - startTime) / 1000);
    setGauge('process_memory_rss_bytes', process.memoryUsage().rss);
    const body = renderMetrics();
    reply.header('Content-Type', 'text/plain; version=0.0.4');
    return reply.send(body);
  });
}
