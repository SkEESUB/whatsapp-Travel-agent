// PM2 Configuration
// Process Manager for Node.js

module.exports = {
  apps: [
    {
      // ============================================
      // Application Name
      // ============================================
      name: 'travelbot',
      
      // ============================================
      // Script Entry Point
      // ============================================
      script: 'src/app.js',
      
      // ============================================
      // Cluster Mode (use all CPU cores)
      // ============================================
      instances: 'max',  // Auto-detect CPU cores
      exec_mode: 'cluster',
      
      // ============================================
      // Environment Variables
      // ============================================
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3000,
      },
      
      // ============================================
      // Auto-Restart Configuration
      // ============================================
      autorestart: true,
      watch: false,  // Set to true for development
      ignore_watch: ['node_modules', 'logs', '*.log'],
      watch_options: {
        followSymlinks: false,
      },
      
      // ============================================
      // Memory Management
      // ============================================
      max_memory_restart: '500M',  // Restart if memory exceeds 500MB
      kill_timeout: 5000,  // Wait 5s before force killing
      
      // ============================================
      // Cron Restart (optional)
      // ============================================
      // cron_restart: '0 0 * * *',  // Restart daily at midnight
      
      // ============================================
      // Logging Configuration
      // ============================================
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      log_file: 'logs/pm2-combined.log',
      out_file: 'logs/pm2-out.log',
      error_file: 'logs/pm2-error.log',
      merge_logs: true,  // Merge logs from all instances
      
      // ============================================
      // Log Rotation (requires pm2-logrotate)
      // ============================================
      // Install: pm2 install pm2-logrotate
      max_restarts: 10,
      restart_delay: 4000,
      min_uptime: '10s',
      
      // ============================================
      // Advanced Options
      // ============================================
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      
      // ============================================
      // Source Map Support
      // ============================================
      source_map_support: true,
      
      // ============================================
      // Instance Specific Options
      // ============================================
      time: true,  // Add timestamps to logs
      disable_logs: false,
      
      // ============================================
      // Custom PM2 Variables
      // ============================================
      env_file: '.env',
    },
  ],
  
  // ============================================
  // Deployment Configuration
  // ============================================
  deploy: {
    production: {
      user: 'nodejs',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'git@github.com:your-username/travel-agent.git',
      path: '/var/www/travelbot',
      'post-deploy': 'npm install && pm2 reload pm2.config.js --env production && pm2 save',
      'pre-deploy-local': 'echo "Deploying to production..."',
      'post-setup': 'npm install',
      env: {
        NODE_ENV: 'production',
      },
    },
    
    staging: {
      user: 'nodejs',
      host: 'your-staging-server-ip',
      ref: 'origin/develop',
      repo: 'git@github.com:your-username/travel-agent.git',
      path: '/var/www/travelbot-staging',
      'post-deploy': 'npm install && pm2 reload pm2.config.js --env staging && pm2 save',
      env: {
        NODE_ENV: 'staging',
      },
    },
  },
};
