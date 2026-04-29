import { defineBackend } from '@aws-amplify/backend';
import {
  AttributeType,
  BillingMode,
  Table,
} from 'aws-cdk-lib/aws-dynamodb';
import {
  Function as LambdaFunction,
  FunctionUrlAuthType,
} from 'aws-cdk-lib/aws-lambda';
import { apiFunction } from './functions/api/resource';

const backend = defineBackend({
  apiFunction,
});

const stack = backend.createStack('PingtourApi');

const stateTable = new Table(stack, 'StateTable', {
  partitionKey: { name: 'pk', type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
});

const lambda = backend.apiFunction.resources.lambda as LambdaFunction;

stateTable.grantReadWriteData(lambda);
lambda.addEnvironment('STATE_TABLE_NAME', stateTable.tableName);

// Public Function URL — no IAM auth, browser hits it directly. The
// Lambda enforces password-cookie auth on mutations.
//
// CORS is handled by the Lambda itself (it echoes the request Origin
// in `access-control-allow-origin` and sets `allow-credentials: true`),
// which is the only way to allow credentialed requests from any origin.
// The CDK `cors` block here would force `allowedOrigins: ['*']` plus
// `allowCredentials: true`, which AWS rejects at deploy time.
const fnUrl = lambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
});

// Surface the URL in `amplify_outputs.json` for the frontend to pick up.
backend.addOutput({
  custom: {
    apiUrl: fnUrl.url,
  },
});
