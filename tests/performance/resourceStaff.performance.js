/* eslint-disable no-console */
const autocannon = require('autocannon');

const BASE_URL = process.env.PERF_BASE_URL || 'http://localhost:5000';
const AUTH_TOKEN = process.env.PERF_AUTH_TOKEN;
const CONNECTIONS = Number(process.env.PERF_CONNECTIONS || 20);
const DURATION = Number(process.env.PERF_DURATION || 20);

if (!AUTH_TOKEN) {
  console.error('Missing PERF_AUTH_TOKEN. Export a valid Bearer token for ADMIN/OFFICER before running performance tests.');
  process.exit(1);
}

const buildHeaders = () => ({
  Authorization: `Bearer ${AUTH_TOKEN}`,
  'Content-Type': 'application/json'
});

const runScenario = (title, options) => {
  console.log(`\n=== ${title} ===`);

  return new Promise((resolve, reject) => {
    const instance = autocannon(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });

    autocannon.track(instance, { renderProgressBar: true, renderLatencyTable: true });
  });
};

(async () => {
  try {
    const scenarios = [
      {
        title: 'GET /api/resources',
        options: {
          url: `${BASE_URL}/api/resources`,
          method: 'GET',
          headers: buildHeaders(),
          connections: CONNECTIONS,
          duration: DURATION
        }
      },
      {
        title: 'GET /api/staff (admin only endpoint)',
        options: {
          url: `${BASE_URL}/api/staff`,
          method: 'GET',
          headers: buildHeaders(),
          connections: CONNECTIONS,
          duration: DURATION
        }
      }
    ];

    for (const scenario of scenarios) {
      const result = await runScenario(scenario.title, scenario.options);
      console.log(`Requests/sec: ${result.requests.average.toFixed(2)}`);
      console.log(`Latency p95: ${result.latency.p95.toFixed(2)} ms`);
      console.log(`Throughput avg: ${(result.throughput.average / 1024).toFixed(2)} KB/s`);
    }

    console.log('\nPerformance tests completed.');
  } catch (error) {
    console.error('Performance test run failed:', error.message);
    process.exit(1);
  }
})();
