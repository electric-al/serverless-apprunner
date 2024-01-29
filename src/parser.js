'use strict';

const { get } = require('./util');


module.exports = config => {
  return {
    serviceName: config.serviceName,
    memory: config.memory || '0.5GB',
    cpu: config.cpu || 256,
    image: config.image,
    httpPort: config.httpPort, 
    environment: config.environment || {},
    iamRoleStatements: config.iamRoleStatements || [],
    vpc: {
      subnetIds: get(config, 'vpc.subnetIds', []),
      securityGroupIds: get(config, 'vpc.securityGroupIds', []),
      assignPublicIp: get(config, 'vpc.assignPublicIp', false),
    },
    tags: config.tags || {},
  };
};