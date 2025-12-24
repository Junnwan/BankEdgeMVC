resource "aws_guardduty_detector" "main" {
  enable = true

  tags = {
    Name = "${var.project_name}-guardduty"
  }
}
