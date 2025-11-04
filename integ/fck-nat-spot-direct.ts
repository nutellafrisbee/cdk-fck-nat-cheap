/* eslint-disable no-new */

import { App, Stack, aws_ec2 as ec2 } from "aws-cdk-lib";
import { FckNatInstanceProvider } from '../src';
import * as dotenv from 'dotenv';

dotenv.config();

const app = new App();
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION };

// Create a test stack to demonstrate the direct spot configuration
const directStack = new Stack(app, 'FckNatSpotDirectTestStack', { env });

// Create VPC with FckNat using spot instances directly
const vpc = new ec2.Vpc(directStack, 'VPC', {
  maxAzs: 2,
  natGatewayProvider: new FckNatInstanceProvider({
    instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.NANO),
    useSpotInstances: true,
    spotAllocationStrategy: 'capacity-optimized',
  }),
});

// Create a bastion host to test connectivity
const bastion = new ec2.BastionHostLinux(directStack, 'Bastion', {
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
