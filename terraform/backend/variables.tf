variable "region" {
  default = "ap-southeast-1"
}

variable "bucket_name" {
  default = "bankedge-terraform-state-junnnwan"
}

variable "dynamodb_table_name" {
  default = "bankedge-terraform-locks"
}
