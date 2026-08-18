#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { UrbTecTrackUatStack } from '../lib/uat-stack.js';

const app = new cdk.App();
new UrbTecTrackUatStack(app, 'UrbTecTrackUat', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'ap-south-1',
  },
  description: 'Urb TecTrack UAT — Fargate + RDS PostgreSQL + S3 (dev-sized)',
});
