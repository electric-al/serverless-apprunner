"use strict";
const crypto = require("crypto");

const toIdentifier = (name) => {
  return name
    .replaceAll("-", " ")
    .split(" ")
    .map((w) => w[0].toUpperCase() + w.substring(1).toLowerCase())
    .join("")
    .replace(/[^0-9A-Za-z]/g, "");
};

const toTags = (tags) =>
  Object.entries(tags).map(([Key, Value]) => ({ Key, Value }));

const toEnvironment = (tags) =>
  Object.entries(tags).map(([Name, Value]) => ({ Name, Value }));

const compileImageAccessRole = (images, ret, serverless) => {
  ret.Resources.AppRunnerImageAccessRole = {
    Type: "AWS::IAM::Role",
    Properties: {
      AssumeRolePolicyDocument: {
        Version: "2008-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: {
              Service: ["build.apprunner.amazonaws.com"],
            },
            Action: "sts:AssumeRole",
          },
        ],
      },
      ManagedPolicyArns: [
        "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess",
      ],
    },
  };
};

const compileVpcConnector = (images, ret, serverless) => {
  const stage = serverless.variables.options.stage;
  const serverlessServiceName = serverless.variables.service.service;

  // Hash the current VPC settings so a new VPC connector is made if VPC changes
  const hash = crypto
    .createHash("md5")
    .update(JSON.stringify(serverless.variables.service.provider.vpc))
    .digest("hex");

  ret.Resources.AppRunnerServiceVpcConnector = {
    Type: "AWS::AppRunner::VpcConnector",
    Properties: {
      SecurityGroups:
        serverless.variables.service.provider.vpc.securityGroupIds,
      Subnets: serverless.variables.service.provider.vpc.subnetIds,
      VpcConnectorName: `${serverlessServiceName}-${stage}-vpc-connector-${hash.substring(
        0,
        6
      )}`,
    },
  };
};

const compileServiceInstanceRole = (
  serviceId,
  service,
  images,
  ret,
  serverless
) => {
  const stage = serverless.variables.options.stage;
  const serverlessServiceName = serverless.variables.service.service;

  const cfId = toIdentifier(serviceId);
  const instanceRoleCfId = `${cfId}AppRunnerInstanceRole`;

  ret.Resources[instanceRoleCfId] = {
    Type: "AWS::IAM::Role",
    Properties: {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Effect: "Allow",
            Principal: {
              Service: "tasks.apprunner.amazonaws.com",
            },
            Action: "sts:AssumeRole",
          },
        ],
      },
      Policies: [
        // Add permissions required by this service to run here.
        // Required for admin/user management
        {
          PolicyName: `${serverlessServiceName}-${stage}-${cfId}-policy`,
          PolicyDocument: {
            Statement: service.iamRoleStatements,
          },
        },
      ],
    },
  };

  return instanceRoleCfId;
};

const compileService = (serviceId, service, images, ret, serverless) => {
  const cfId = toIdentifier(serviceId);

  const instanceRoleName = compileServiceInstanceRole(
    serviceId,
    service,
    images,
    ret,
    serverless
  );
  const serviceCfId = `${cfId}AppRunnerService`;

  const envVars = toEnvironment(service.environment);

  ret.Resources[serviceCfId] = {
    Type: "AWS::AppRunner::Service",
    Properties: {
      ServiceName: service.serviceName,
      SourceConfiguration: {
        AuthenticationConfiguration: {
          AccessRoleArn: { "Fn::GetAtt": ["AppRunnerImageAccessRole", "Arn"] },
        },
        AutoDeploymentsEnabled: false,
        ImageRepository: {
          ImageIdentifier: images[serviceId],
          ImageRepositoryType: "ECR",
          ImageConfiguration: {
            Port: service.httpPort,
            RuntimeEnvironmentVariables: envVars,
          },
        },
      },
      Tags: toTags(service.tags),
      NetworkConfiguration: {
        EgressConfiguration: {
          EgressType: "VPC",
          VpcConnectorArn: {
            "Fn::GetAtt": ["AppRunnerServiceVpcConnector", "VpcConnectorArn"],
          },
        },
      },
      InstanceConfiguration: {
        Cpu: `${service.cpu}`,
        Memory: `${service.memory}`,
        InstanceRoleArn: { "Fn::GetAtt": [instanceRoleName, "Arn"] },
      },
    },
  };
};

module.exports = (images, config, serverless) => {
  const ret = {
    Resources: {},
    Outputs: {},
  };
  compileImageAccessRole(images, ret, serverless);
  compileVpcConnector(images, ret, serverless);

  for (const serviceId of Object.keys(config.services)) {
    const service = config.services[serviceId];
    compileService(serviceId, service, images, ret, serverless);
  }

  return ret;
};
