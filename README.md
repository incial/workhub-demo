# Incial WorkHub

## Production Observability Setup (EC2 + RDS + Docker)

### Prerequisites
- Docker Engine + Docker Compose installed on EC2
- Server env file at `server/.env` (copy from `server/.env.example`)
- Alertmanager env file at `monitoring/alertmanager/.env` (copy from `monitoring/alertmanager/.env.example`)

### Deploy stack
```bash
docker-compose up -d
```

### Services
- `app` (Spring Boot) on internal `app:8080`
- `prometheus` scraping `app:8080/actuator/prometheus`
- `grafana` with auto-provisioned datasource + dashboard
- `alertmanager` for SMTP email notifications

### Access
- Grafana: `http://<ec2-host>:3000` (bind is localhost by default in compose; use SSH tunnel or reverse proxy)
- Prometheus: internal only (`9090` not published)
- App metrics endpoint: internal/private-network only

### Security configuration
- Public: `/actuator/health`, `/actuator/info`
- Protected: `/actuator/prometheus` (allowed only from private networks: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, loopback)

### Alert email setup
1. Copy `monitoring/alertmanager/.env.example` to `monitoring/alertmanager/.env`
2. Fill SMTP settings (Gmail app password or AWS SES SMTP credentials)
3. Restart Alertmanager service:
   ```bash
   docker-compose up -d alertmanager
   ```

### App email deliverability setup
For Gmail inbox placement, send from a real mailbox that matches your authenticated SMTP account or a verified Google Workspace alias.

1. In `server/.env`, set:
   ```env
   MAIL_USERNAME=no-reply@yourdomain.com
   MAIL_PASSWORD=your_google_app_password
   MAIL_FROM_ADDRESS=no-reply@yourdomain.com
   MAIL_FROM_NAME=Incial WorkHub
   MAIL_REPLY_TO=support@yourdomain.com
   MAIL_MESSAGE_ID_DOMAIN=yourdomain.com
   APP_PUBLIC_BASE_URL=https://workhub.yourdomain.com
   ```
2. In DNS for the sender domain, publish SPF, enable DKIM in Google Workspace, and publish a DMARC TXT record.
3. Send a test email to Gmail, open **Show original**, and confirm SPF, DKIM, and DMARC pass with the same From domain.

### RDS PostgreSQL monitoring (pg_stat_statements)
Do this in AWS RDS (not local config files):

1. Update DB parameter group:
   - `log_min_duration_statement = 200`
   - `shared_preload_libraries = pg_stat_statements`
2. Reboot RDS instance
3. Enable extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
   ```

### Query analysis commands
Top slow queries (mean time):
```sql
SELECT query,
       calls,
       round(mean_exec_time::numeric, 2) AS mean_ms,
       round(total_exec_time::numeric, 2) AS total_ms,
       rows
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

Highest total execution time:
```sql
SELECT query,
       calls,
       round(total_exec_time::numeric, 2) AS total_ms,
       round(mean_exec_time::numeric, 2) AS mean_ms
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

Optional periodic persistence (manual snapshot table):
```sql
CREATE TABLE IF NOT EXISTS query_stats_snapshot AS
SELECT now() AS captured_at, *
FROM pg_stat_statements
WHERE false;

INSERT INTO query_stats_snapshot
SELECT now() AS captured_at, *
FROM pg_stat_statements;
```

### Load test (k6)
Script: `monitoring/k6/load-test.js` hitting real APIs:
- `/api/v1/auth/login`
- `/api/v1/projects/dashboard?role=EXECUTIVE`
- `/api/v1/projects/completed`

Run:
```bash
k6 run \
  -e BASE_URL=http://localhost:8080 \
  -e LOGIN_EMAIL=admin@example.com \
  -e LOGIN_PASSWORD=your_password \
  monitoring/k6/load-test.js
```
