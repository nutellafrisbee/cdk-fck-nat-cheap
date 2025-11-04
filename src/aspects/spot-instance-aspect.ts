import { IAspect, aws_autoscaling as autoscaling, aws_ec2 as ec2 } from 'aws-cdk-lib';
import { IConstruct } from 'constructs';

/**
 * Configuration options for the FckNatSpotInstanceAspect
 */
export interface FckNatSpotInstanceAspectProps {
  /**
   * Maximum price per hour you're willing to pay for spot instances (in USD).
   * If not specified, the on-demand price is used as the maximum.
   *
   * @default - On-demand price
   */
  readonly spotMaxPrice?: string;

  /**
   * Spot allocation strategy to use when launching spot instances.
   * - 'lowest-price': Launch instances from the lowest priced pool
   * - 'capacity-optimized': Launch instances from pools with optimal capacity for the number of instances launching
   * - 'capacity-optimized-prioritized': Launch instances from pools with optimal capacity, using instance type priority
   *
   * @default 'capacity-optimized' - Best for availability and cost balance
   */
  readonly spotAllocationStrategy?: 'lowest-price' | 'capacity-optimized' | 'capacity-optimized-prioritized';
}

/**
 * CDK Aspect that converts FckNat instances to use Spot instances for cost optimization.
 *
 * This aspect can be applied to a Stack, Construct, or the entire App to automatically
 * convert all FckNat instances to use Spot pricing instead of On-Demand pricing.
 *
 * Example usage:
 * ```typescript
 * import { FckNatSpotInstanceAspect } from 'cdk-fck-nat';
 * import { Aspects } from 'aws-cdk-lib';
 *
 * const app = new cdk.App();
 * const stack = new cdk.Stack(app, 'MyStack');
 *
 * // ... create VPC with FckNat provider ...
 *
 * // Apply spot instances to all FckNat instances in the stack
 * Aspects.of(stack).add(new FckNatSpotInstanceAspect());
 * ```
 *
 * Spot instances provide significant cost savings (typically 50-90% off on-demand pricing)
 * but can be interrupted by AWS when capacity is needed elsewhere. For NAT instances,
 * this is generally acceptable as the Auto Scaling Group will automatically launch
 * a replacement instance.
 */
export class FckNatSpotInstanceAspect implements IAspect {
  constructor(private readonly props: FckNatSpotInstanceAspectProps = {}) {}

  public visit(node: IConstruct): void {
    // Look for AutoScalingGroups that are part of FckNat
    if (node instanceof autoscaling.AutoScalingGroup) {
      // Check if this ASG is a FckNat ASG by looking at the construct ID
      // FckNat creates ASGs with the ID 'FckNatAsg'
      if (node.node.id === 'FckNatAsg') {
        this.convertToSpotInstance(node);
      }
    }
  }

  private convertToSpotInstance(asg: autoscaling.AutoScalingGroup): void {
    const cfnAsg = asg.node.defaultChild as autoscaling.CfnAutoScalingGroup;

    // Get the launch template from the ASG
    // We need to extract it before removing the property
    const launchTemplate = cfnAsg.launchTemplate as autoscaling.CfnAutoScalingGroup.LaunchTemplateSpecificationProperty;

    if (!launchTemplate) {
      console.warn(`FckNatSpotInstanceAspect: Could not find launch template for ASG ${asg.node.path}`);
      return;
    }

    // Get the instance type from the launch template
    // Since we can't easily access the instance type from the CFN properties,
    // we'll need to get it from the ASG or use a default in overrides
    // For now, we'll let AWS use the instance type from the launch template
    const instanceType = this.getInstanceTypeFromAsg(asg);

    // Remove the launch template property as it conflicts with mixed instances policy
    cfnAsg.addPropertyDeletionOverride('LaunchTemplate');

    // Configure mixed instances policy for spot instances
    const allocationStrategy = this.props.spotAllocationStrategy ?? 'capacity-optimized';

    const mixedInstancesPolicy: autoscaling.CfnAutoScalingGroup.MixedInstancesPolicyProperty = {
      launchTemplate: {
        launchTemplateSpecification: {
          launchTemplateId: launchTemplate.launchTemplateId,
          version: launchTemplate.version,
        },
        overrides: instanceType ? [{
          instanceType: instanceType,
        }] : undefined,
      },
      instancesDistribution: {
        onDemandPercentageAboveBaseCapacity: 0, // 100% spot instances
        spotAllocationStrategy: allocationStrategy,
        ...(this.props.spotMaxPrice && { spotMaxPrice: this.props.spotMaxPrice }),
      },
    };

    cfnAsg.mixedInstancesPolicy = mixedInstancesPolicy;

    // Add metadata to indicate this ASG has been converted to spot
    asg.node.addMetadata('fck-nat:spot-enabled', 'true');
  }

  /**
   * Attempt to get the instance type from the ASG.
   * This is a best-effort approach as the instance type might be in the launch template.
   */
  private getInstanceTypeFromAsg(asg: autoscaling.AutoScalingGroup): string | undefined {
    // Try to find the instance type in the construct tree
    // The FckNat construct should have stored this information
    const parent = asg.node.scope;
    if (parent && 'instanceType' in parent) {
      const instanceType = (parent as any).instanceType as ec2.InstanceType;
      return instanceType?.toString();
    }
    return undefined;
  }
}
