output "target_group_arn" {
  value = aws_lb_target_group.main.arn
}

output "dns_name" {
  value = aws_lb.main.dns_name
}

output "alb_arn_suffix" {
  value = aws_lb.main.arn_suffix
}

output "target_group_arn_suffix" {
  value = aws_lb_target_group.main.arn_suffix
}
