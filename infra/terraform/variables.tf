variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.medium"
}

variable "key_name" {
  description = "SSH key pair name"
  type        = string
}

variable "domain_name" {
  description = "Domain name for the application (optional)"
  type        = string
  default     = ""
}

variable "app_name" {
  description = "Application name for resource tagging"
  type        = string
  default     = "runa"
}
