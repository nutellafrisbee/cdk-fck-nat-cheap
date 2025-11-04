/* eslint-disable no-new */

import { App, Stack, Aspects, aws_ec2 as ec2 } from "aws-cdk-lib";
import { FckNatInstanceProvider, FckNatSpotInstanceAspect } from '../src';
import * as dotenv from 'dotenv';

dotenv.config();

const app = new App();
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION };

// Create a test stack to demonstrate the aspect approach
const aspectStack = new Stack(app, 'FckNatSpotAspectTestStack', { env });

// Create VPC with standard FckNat (no spot configuration)
const vpc = new ec2.Vpc(aspectStack, 'VPC', {
  maxAzs: 2,
  natGatewayProvider: new FckNatInstanceProvider({
    instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.NANO),
  }),
});

// Apply spot instances to all FckNat instances using the aspect
Aspects.of(aspectStack).add(new FckNatSpotInstanceAspect({
  spotAllocationStrategy: 'capacity-optimized',
}));

// Create a bastion host to test connectivity
const bastion = new ec2.BastionHostLinux(aspectStack, 'Bastion', {
  vpc,
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.NANO),
});

bastion.instance.addUserData(
  '#!/bin/bash',
  'yum install -y curl',
  'echo "Testing internet connectivity..."',
  'curl -s https://ifconfig.me',
);

app.synth();
