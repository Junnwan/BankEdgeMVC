terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

# 1. Network Module
module "vpc" {
  source = "./modules/vpc"

  region                = var.region
  project_name          = var.project_name
  vpc_cidr              = var.vpc_cidr
  public_subnet_1_cidr  = var.public_subnet_1_cidr
  public_subnet_2_cidr  = var.public_subnet_2_cidr
  private_subnet_1_cidr = var.private_subnet_1_cidr
  private_subnet_2_cidr = var.private_subnet_2_cidr
}

# 2. Security Module
module "security" {
  source = "./modules/security"

  project_name = var.project_name
  vpc_id       = module.vpc.vpc_id
}

# 3. Database Module
module "database" {
  source = "./modules/database"

  project_name      = var.project_name
  subnet_ids        = module.vpc.private_subnet_ids
  security_group_id = module.security.rds_sg_id
  db_name           = var.db_name
  db_username       = var.db_username
  db_password       = var.db_password
}

# 4. Load Balancer Module
module "alb" {
  source = "./modules/alb"

  project_name      = var.project_name
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
  security_group_id = module.security.alb_sg_id
}

# 5. Compute Module (App)
module "compute" {
  source = "./modules/compute"

  project_name = var.project_name
  # Use first private subnet for simplicity, typically would use ASG for HA
  subnet_ids        = module.vpc.private_subnet_ids
  security_group_id = module.security.ec2_sg_id
  target_group_arn  = module.alb.target_group_arn

  db_endpoint = module.database.db_endpoint
  db_username = var.db_username
  db_password = var.db_password
  db_name     = module.database.db_name

  docker_image = var.docker_image
}

# 6. WAF Module (Global)
module "waf" {
  source = "./modules/waf"

  project_name = var.project_name

  providers = {
    aws = aws.us_east_1
  }
}

# 7. CDN Module (CloudFront)
module "cdn" {
  source = "./modules/cdn"

  project_name = var.project_name
  alb_dns_name = module.alb.dns_name
  web_acl_arn  = module.waf.web_acl_arn
}
