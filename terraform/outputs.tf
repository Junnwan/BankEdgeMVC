output "application_url" {
  description = "The DNS name of the Load Balancer"
  value       = "http://${module.alb.dns_name}"
}

output "rds_endpoint" {
  description = "AWS RDS Endpoint (Internal)"
  value       = module.database.db_endpoint
}
