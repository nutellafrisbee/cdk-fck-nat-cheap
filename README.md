# CDK fck-nat

A CDK construct for deploying NAT Instances using [fck-nat](https://github.com/AndrewGuenther/fck-nat). The (f)easible (c)ost (k)onfigurable NAT!

* Overpaying for AWS Managed NAT Gateways? fck-nat.
* Want to use NAT instances and stay up-to-date with the latest security patches? fck-nat.
* Want to reuse your Bastion hosts as a NAT? fck-nat.

fck-nat offers a ready-to-use ARM and x86 based AMIs built on Amazon Linux 2023 which can support up to 5Gbps NAT traffic
on a t4g.nano instance. How does that compare to a Managed NAT Gateway?

Hourly rates:
* Managed NAT Gateway hourly: $0.045
* t4g.nano hourly: $0.0042

Per GB rates:
* Managed NAT Gateway per GB: $0.045
* fck-nat per GB: $0.00

Sitting idle, fck-nat costs 10% of a Managed NAT Gateway. In practice, the savings are even greater.

*"But what about AWS' NAT Instance AMI?"*

The official AWS supported NAT Instance AMI hasn't been updates since 2018, is still running Amazon Linux 1 which is
now EOL, and has no ARM support, meaning it can't be deployed on EC2's most cost effective instance types. fck-nat.

*"When would I want to use a Managed NAT Gateway instead of fck-nat?"*

AWS limits outgoing internet bandwidth on EC2 instances to 5Gbps. This means that the highest bandwidth that fck-nat
can support is 5Gbps. This is enough to cover a very broad set of use cases, but if you need additional bandwidth,
you should use Managed NAT Gateway. If AWS were to lift the limit on internet egress bandwidth from EC2, you could
cost-effectively operate fck-nat at speeds up to 25Gbps, but you wouldn't need Managed NAT Gateway then would you?
fck-nat.

Read more about EC2 bandwidth limits here: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-network-bandwidth.html

## Even Cheaper with Spot Instances

You can reduce costs even further by using EC2 Spot Instances. Spot instances typically cost 50-90% less than on-demand instances.

Hourly rates (with spot instances):
* Managed NAT Gateway hourly: $0.045
* t4g.nano spot hourly: ~$0.0013 (69% savings vs on-demand)
* t4g.nano on-demand hourly: $0.0042

**Spot instances for NAT are generally safe** because:
* Auto Scaling Groups automatically replace interrupted instances
* Interruptions are rare for small instance types
* Brief connectivity loss during replacement is acceptable for most use cases
* Spot capacity-optimized allocation strategy minimizes interruptions

### Usage

You can enable spot instances in two ways:

#### Method 1: Using the `useSpotInstances` property (Direct)

```typescript
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { FckNatInstanceProvider } from 'cdk-fck-nat';

const stack = new cdk.Stack(app, 'MyStack');

const vpc = new ec2.Vpc(stack, 'VPC', {
  natGatewayProvider: new FckNatInstanceProvider({
    instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.NANO),
    useSpotInstances: true, // Enable spot instances
  }),
});
```

#### Method 2: Using the Aspect (Drop-in replacement)

The aspect approach allows you to convert existing FckNat instances to spot without modifying the original code:

```typescript
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { FckNatInstanceProvider, FckNatSpotInstanceAspect } from 'cdk-fck-nat';
import { Aspects } from 'aws-cdk-lib';

const app = new cdk.App();
const stack = new cdk.Stack(app, 'MyStack');

// Create VPC with standard FckNat (existing code, no changes needed)
const vpc = new ec2.Vpc(stack, 'VPC', {
  natGatewayProvider: new FckNatInstanceProvider({
    instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.NANO),
  }),
});

// Apply spot instances to all FckNat instances in the stack
Aspects.of(stack).add(new FckNatSpotInstanceAspect());
```

#### Advanced Options

Both methods support additional configuration:

```typescript
// Direct method with options
const vpc = new ec2.Vpc(stack, 'VPC', {
  natGatewayProvider: new FckNatInstanceProvider({
    instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.NANO),
    useSpotInstances: true,
    spotMaxPrice: '0.004', // Optional: maximum price per hour
    spotAllocationStrategy: 'capacity-optimized', // 'lowest-price' | 'capacity-optimized' | 'capacity-optimized-prioritized'
  }),
});

// Aspect method with options
Aspects.of(stack).add(new FckNatSpotInstanceAspect({
  spotMaxPrice: '0.004',
  spotAllocationStrategy: 'capacity-optimized',
}));
```

**Recommendation:** Use `capacity-optimized` allocation strategy (default) for best availability and to minimize interruptions.
