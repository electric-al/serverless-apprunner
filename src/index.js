'use strict';

const { get } = require('./util');
const compile = require('./compiler');
const parse = require('./parser');

class ServerlessAppRunner {
  constructor(serverless, cliOptions, { log }) {
    serverless.configSchemaHandler.defineTopLevelProperty(
      'apprunner',
      require('./schema')
    );
    this.log = log;
    const config = get(serverless, 'configurationInput.apprunner', {});

    if (!config?.services) {
      this.log.info(`AppRunner: No services defined. Skipping.`);
      return;
    }

    this.config = config;
    this.serverless = serverless;
    this.hooks = {
      'package:compileFunctions': this.compileServices.bind(this),
    };
  }

  async compileServices() {
    const parsedConfig = {
      ...this.config,
    }
    for(const serviceId of Object.keys(this.config.services)) {
      const originalService = this.config.services[serviceId];
      const service = parse({
        ...originalService,
        environment: this.getEnvironmentVariables(originalService),
        tags: this.getResourceTags(originalService),
        iamRoleStatements: this.getIamRoleStatements(originalService),
      });
      parsedConfig[serviceId] = service;
    }

    const images = await this.resolveServicesImages(parsedConfig.services);

    const compiled = compile(images, parsedConfig, this.serverless);
  
    const template =
      this.serverless.service.provider.compiledCloudFormationTemplate;
    template.Resources = {
      ...template.Resources,
      ...compiled.Resources,
    };
    template.Outputs = {
      ...template.Outputs,
      ...compiled.Outputs,
    };
  }

  // Uses the frameworks internal means of building images, allowing the plugin
  // to use the same ECR image defintion as you would with a Lambda function.
  async resolveServicesImages(services) {
    const images = {};

    for (const serviceId of Object.keys(services)) {
      const service = services[serviceId];
      const fakeFunctionName = `fake-${service.serviceName}`;

      this.serverless.service.functions[fakeFunctionName] = {
        image: service.image,
      };

      const { functionImageUri } = await this.serverless
        .getProvider('aws')
        .resolveImageUriAndSha(fakeFunctionName);

      images[serviceId] = functionImageUri;

      delete this.serverless.service.functions[fakeFunctionName];
    }

    return images;
  }

  getIamRoleStatements(originalService) {
    const providerStatements = get(
      this.serverless.service.provider,
      'iam.role.statements',
      []
    );

    return [
      ...providerStatements,
      ...(this.serverless.service.provider.iamRoleStatements || []),
      ...(originalService.iamRoleStatements || []),
    ];
  }

  getResourceTags(originalService) {
    return {
      ...(this.serverless.service.provider.tags || {}),
      ...(originalService.tags || {}),
    };
  }

  getEnvironmentVariables(originalService) {
    return {
      ...(this.serverless.service.provider.environment || {}),
      ...(originalService.environment || {}),
    };
  }
}

module.exports = ServerlessAppRunner;