terraform {
  backend "s3" {
    bucket         = "bankedge-terraform-state-junnnwan"
    key            = "prod/terraform.tfstate"
    region         = "ap-southeast-1"
    encrypt        = true
    dynamodb_table = "bankedge-terraform-locks" # Optional but recommended
  }
}
