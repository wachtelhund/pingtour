import { defineBackend } from '@aws-amplify/backend';
import {
  AttributeType,
  BillingMode,
  Table,
} from 'aws-cdk-lib/aws-dynamodb';
import { Duration } from 'aws-cdk-lib';
import {
  Function as LambdaFunction,
  FunctionUrlAuthType,
  HttpMethod,
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
const fnUrl = lambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
  cors: {
    allowedOrigins: ['*'],
    allowedMethods: [HttpMethod.GET, HttpMethod.POST, HttpMethod.OPTIONS],
    allowedHeaders: ['content-type'],
    allowCredentials: true,
    maxAge: Duration.minutes(10),
  },
});

// Surface the URL in `amplify_outputs.json` for the frontend to pick up.
backend.addOutput({
  custom: {
    apiUrl: fnUrl.url,
  },
});
