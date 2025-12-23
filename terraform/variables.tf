variable "region" {
  default = "ap-southeast-1"
}

variable "project_name" {
  default = "bankedge"
}

variable "db_username" {
  description = "RDS Username"
  sensitive   = true
}

variable "db_password" {
  description = "RDS Password"
  sensitive   = true
}

variable "db_name" {
  default = "bankedge_db"
}

variable "docker_image" {
  description = "Docker Hub Image (e.g. user/repo:tag)"
}

variable "vpc_cidr" {
  default = "10.0.0.0/16"
}
# Subnet definitions...
variable "public_subnet_1_cidr" { default = "10.0.1.0/24" }
variable "public_subnet_2_cidr" { default = "10.0.2.0/24" }
variable "private_subnet_1_cidr" { default = "10.0.3.0/24" }
variable "private_subnet_2_cidr" { default = "10.0.4.0/24" }


variable "stripe_publishable_key" {
  description = "Stripe Publishable Key"
  sensitive   = true
  default     = "pk_test_placeholder"
}

variable "stripe_secret_key" {
  description = "Stripe Secret Key"
  sensitive   = true
  default     = "sk_test_placeholder"
}

variable "domain_name" {
  description = "Domain name for ACM Certificate"
  default     = "bankedge.com"
}
