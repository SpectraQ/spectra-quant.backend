// PM2 ecosystem for EC2. Run from this directory:
//   pm2 start ecosystem.config.cjs
//   pm2 save && pm2 startup    # persist across reboots
//   pm2 logs                   # tail both
//   pm2 restart all
//   pm2 stop all
//
// Reads HELIUS_RPC_URL, ANCHOR_WALLET, etc. from the shell environment
// (export them in ~/.bashrc or use `pm2 start ... --update-env` after
// sourcing .env). Anything set below overrides the inherited value.

const path = require("path");
const ROOT = __dirname;

module.exports = {
  apps: [
    {
      name: "spectraq-agent",
      cwd: ROOT,
      script: "pnpm",
      args: "--filter agent start",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
        MOCK_MPC: "true",
      },
      max_memory_restart: "512M",
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 20,
      out_file: path.join(ROOT, "logs/agent.out.log"),
      error_file: path.join(ROOT, "logs/agent.err.log"),
      merge_logs: true,
      time: true,
    },
    {
      name: "spectraq-rebalancer",
      cwd: ROOT,
      script: "pnpm",
      args: "exec ts-node --transpile-only scripts/rebalance_pool.ts",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
        REBALANCE_LOOP: "true",
        INTERVAL_SEC: "180",
        REBALANCE_TOLERANCE_BPS: "300",
        MAX_REBALANCE_USDC: "200",
      },
      max_memory_restart: "512M",
      autorestart: true,
      restart_delay: 10000,
      max_restarts: 20,
      out_file: path.join(ROOT, "logs/rebalancer.out.log"),
      error_file: path.join(ROOT, "logs/rebalancer.err.log"),
      merge_logs: true,
      time: true,
    },
  ],
};
