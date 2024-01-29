# serverless-apprunner

A serverless plugin that allows you to deploy docker based serverless HTTP services via App Runner.

It is heavily inspired by the [serverless-fargate](https://github.com/eddmann/serverless-fargate) plugin.

## Overview

Sometimes, Lambda based API gateway services are not the best fit for complex HTTP services. Docker and frameworks like express can make these easier to use and manage in production. Also complex multi-route services via many Lambdas have the 'cold-start' problem, especially in VPCs, where each route (individual lambdas) must be kept warm with provisioned concurrency to offer a fast user experience, however this cost can add up.

App Runner makes it easy to deploy Docker based HTTP services into a serverless compute environment, combining the best elements of serverless (no servers to manage, pay by the second), but allowing one instance to serve many routes and parallel requests.

This plugin takes care of:

1. Building and pushing the ECR images (via the native in build SLS functionality)
2. Creating the CloudFormation for the image access IAM role
3. Creating the CloudFormation for the vpc connector
4. Creating the CloudFormation for the service(s) and their execution IAM roles

## Example

```
provider:
  # (required) similar to Lambda-containers, images defined within the provider are available to tasks.
  ecr:
    images:
      my-image:
        path: ./
        file: Dockerfile

  # (optional) role statements present within the provider are added to the task role.
  iamRoleStatements:
    - Effect: Allow
      Action: 'sqs:*'
      Resource: '*'

  # (optional) managed polices present within the provider are added to the task role.
  iamManagedPolicies:
    - arn:aws:iam::123456:policy/my-managed-provider-policy

  # (optional) environment variables present within the provider are added to all tasks.
  environment:
    name: value

  vpc:
    # (required) default security groups which are added to tasks that do not contain any overrides.
    securityGroupIds:
      - sg-12345

    # (required) default subnets which are added to tasks that do not contain any overrides.
    # all tasks MUST be assigned subnets as Fargate operates within `awsvpc` mode.
    subnetIds:
      - subnet-1234

  # (optional) tags present within the provider are added to task resources.
  tags:
    name: value

apprunner:
  services:
    MyService:
      serviceName: 'my-service'
      image: 'my-image'
      cpu: 512
      memory: 1024
      httpPort: 8080
      environment:
        name: value
      iamRoleStatements:
        - Effect: Allow
          Action: 'sqs:*'
          Resource: '*'
```
