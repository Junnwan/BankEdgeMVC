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
  default = "bankedge_prod"
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
