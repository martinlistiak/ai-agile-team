output "public_ip" {
  description = "Public IP address of the EC2 instance"
  value       = aws_eip.runa.public_ip
}

output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.runa.id
}

output "ssh_command" {
  description = "SSH command to connect"
  value       = "ssh -i ~/.ssh/${var.key_name}.pem ubuntu@${aws_eip.runa.public_ip}"
}

output "deploy_steps" {
  description = "Steps to deploy the application"
  value       = <<-EOT
    1. SSH into the server: ssh -i ~/.ssh/${var.key_name}.pem ubuntu@${aws_eip.runa.public_ip}
    2. Clone the repo: git clone <your-repo-url> /opt/runa
    3. Create .env: cp .env.example .env && nano .env
    4. Start services: docker compose -f docker-compose.prod.yml up -d --build
    5. (Optional) Set up SSL: certbot certonly --standalone -d yourdomain.com
  EOT
}
