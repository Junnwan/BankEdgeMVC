variable "project_name" {}

variable "alb_dns_name" {}

variable "web_acl_arn" {
  description = "ARN of the WAF Web ACL to attach"
}
