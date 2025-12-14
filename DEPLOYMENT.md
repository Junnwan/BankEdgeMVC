# BankEdgeMVC Deployment Guide

This guide details how to deploy the BankEdgeMVC application to AWS using Terraform and GitHub Actions.

## Prerequisites
1.  **AWS CLI** installed and configured (`aws configure`).
2.  **Terraform** installed.
3.  **Docker Hub** account.

## Step 1: Infrastructure Provisioning (Terraform)

1.  Navigate to the terraform directory:
    ```bash
    cd terraform
    ```

2.  Initialize Terraform (Downloads providers and sets up S3 backend):
    ```bash
    terraform init
    ```

3.  Create a `terraform.tfvars` file to store your secrets (DO NOT COMMIT THIS FILE):
    ```hcl
    db_username = "dbadmin"
    db_password = "StrongPassword123!"
    docker_image = "your_dockerhub_username/bankedge:latest"
    ```

4.  Review the plan:
    ```bash
    terraform plan
    ```

5.  Apply the configuration:
    ```bash
    terraform apply
    ```
    *Type `yes` when prompted.*

6.  **Output**: Note the `application_url` and `rds_endpoint` provided at the end.

## Step 2: GitHub Actions Configuration

Go to your GitHub Repository -> **Settings** -> **Secrets and variables** -> **Actions**.
Add the following Repository Secrets:

| Secret Name | Value |
| :--- | :--- |
| `AWS_ACCESS_KEY_ID` | Your AWS Access Key |
| `AWS_SECRET_ACCESS_KEY` | Your AWS Secret Key |
| `DOCKER_USERNAME` | Your Docker Hub Username |
| `DOCKER_PASSWORD` | Your Docker Hub Access Token |
| `DATABASE_URL` | `postgresql://dbadmin:StrongPassword123!@<RDS_ENDPOINT_FROM_TERRAFORM>/bankedge_prod` |

## Step 3: Trigger Deployment

1.  Push any change to the `main` branch.
2.  Go to the **Actions** tab in GitHub to see the pipeline run.
    -   **Build Job**: Builds Docker image and pushes to Hub.
    -   **Deploy Job**: Connects to EC2 via SSM and updates the container.
