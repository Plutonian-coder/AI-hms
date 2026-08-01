# Deploying the HMS backend to EC2

One-time setup to move the FastAPI backend off Render onto a t3.micro EC2
instance, reverse-proxied by Nginx with free TLS (no domain required — see
the sslip.io trick in Step 6). Region: `eu-west-2` (matches the existing RDS
instance and S3 bucket — keeps data transfer free and low-latency).

Companion files in this directory:
- `nginx.conf` — reverse proxy template (SSE-safe)
- `deploy.sh` — rebuild + restart the container (used for every redeploy after the first)

See the full walkthrough for AWS console steps, RDS security group changes,
first deploy, and Vercel/Paystack updates.

## Redeploying after the first setup

```bash
ssh -i hms-key.pem ubuntu@<elastic-ip>
cd ~/AI-hms
./infra/ec2/deploy.sh
```

## Rolling back

```bash
cd ~/AI-hms
git log --oneline -5      # find the commit to roll back to
git checkout <commit>
./infra/ec2/deploy.sh
```
