import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export class UrbTecTrackUatStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
      ],
    });

    const uploads = new s3.Bucket(this, 'Uploads', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Free-plan AWS accounts reject VPC Aurora clusters unless they use
    // WithExpressConfiguration (not in CDK yet). RDS Postgres is the UAT fallback.
    const db = new rds.DatabaseInstance(this, 'Db', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      credentials: rds.Credentials.fromGeneratedSecret('tectrack'),
      databaseName: 'tectrack',
      allocatedStorage: 20,
      maxAllocatedStorage: 20,
      storageEncrypted: true,
      multiAz: false,
      publiclyAccessible: false,
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      backupRetention: cdk.Duration.days(1),
      deleteAutomatedBackups: true,
    });

    const sessionSecret = new secretsmanager.Secret(this, 'SessionSecret', {
      description: 'Urb TecTrack UAT session signing key',
      generateSecretString: {
        secretStringTemplate: '{}',
        generateStringKey: 'secret',
        passwordLength: 64,
        excludePunctuation: true,
      },
    });

    const cluster = new ecs.Cluster(this, 'Cluster', { vpc, containerInsights: false });

    const service = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'App', {
      cluster,
      cpu: 512,
      memoryLimitMiB: 1024,
      desiredCount: 1,
      publicLoadBalancer: true,
      listenerPort: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      circuitBreaker: { rollback: true },
      minHealthyPercent: 0,
      maxHealthyPercent: 200,
      taskSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      assignPublicIp: false,
      taskImageOptions: {
        image: ecs.ContainerImage.fromAsset(repoRoot, {
          file: 'Dockerfile',
        }),
        containerPort: 3001,
        enableLogging: true,
        logDriver: ecs.LogDrivers.awsLogs({
          streamPrefix: 'uat',
          logRetention: logs.RetentionDays.TWO_WEEKS,
        }),
        environment: {
          NODE_ENV: 'uat',
          API_HOST: '0.0.0.0',
          API_PORT: '3001',
          WEB_DIST: '/app/apps/web/dist',
          UAT_SEED: 'true',
          COOKIE_SECURE: 'false',
          EMAIL_PROVIDER: 'console',
          EMAIL_REDIRECT_TO: 'uat.urbeno@gmail.com',
          ENABLE_JOBS: 'true',
          AWS_S3_BUCKET: uploads.bucketName,
          DATABASE_USER: 'tectrack',
          DATABASE_NAME: 'tectrack',
          DATABASE_HOST: db.instanceEndpoint.hostname,
        },
        secrets: {
          DATABASE_PASSWORD: ecs.Secret.fromSecretsManager(db.secret!, 'password'),
          SESSION_SECRET: ecs.Secret.fromSecretsManager(sessionSecret, 'secret'),
        },
      },
    });

    service.targetGroup.configureHealthCheck({
      path: '/health',
      healthyHttpCodes: '200',
      interval: cdk.Duration.seconds(30),
      timeout: cdk.Duration.seconds(10),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 5,
    });

    const origin = `http://${service.loadBalancer.loadBalancerDnsName}`;
    service.taskDefinition.defaultContainer?.addEnvironment('PORTAL_URL', origin);
    service.taskDefinition.defaultContainer?.addEnvironment('CORS_ORIGIN', origin);

    db.connections.allowDefaultPortFrom(service.service);
    uploads.grantReadWrite(service.taskDefinition.taskRole);

    new cdk.CfnOutput(this, 'UatUrl', {
      value: origin,
      description: 'Urb TecTrack UAT URL — sign in with admin@urbeno.in / demo',
    });
  }
}
