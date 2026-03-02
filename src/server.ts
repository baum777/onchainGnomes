/**
 * Lightweight Health/Metrics HTTP Server
 *
 * Exposes GET /health and GET /metrics for Render web service.
 * Used by xai-bot-health when deployed alongside the worker.
 */
import http from "node:http";

const PORT = Number(process.env.PORT) || 10000;
const startTime = Date.now();

interface HealthBody {
  ok: boolean;
  version: string;
  uptime: number;
  service: string;
}

const server = http.createServer((req, res) => {
  const url = req.url ?? "/";
  const path = url.split("?")[0];

  if (path === "/health" || path === "/") {
    const body: HealthBody = {
      ok: true,
      version: "1.0.0",
      uptime: Math.floor((Date.now() - startTime) / 1000),
      service: "xai-bot-health",
    };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
    return;
  }

  if (path === "/metrics") {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const metrics = `# HELP bot_uptime_seconds Process uptime in seconds
# TYPE bot_uptime_seconds gauge
bot_uptime_seconds ${uptime}
`;
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(metrics);
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log(`[server] Health server listening on port ${PORT}`);
});
