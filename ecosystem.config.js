module.exports = {
  apps: [
    {
      name: "sunhawk-system",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: "./",
      interpreter: "node",
      watch: false, // Set to false for production, true for development
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_date_format: "年-月-日 HH:mm:ss Z",
      merge_logs: true,
      autorestart: true,
      max_memory_restart: "1G",
    },
  ],
};