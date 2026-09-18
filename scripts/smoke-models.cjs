require('dotenv').config({ quiet: true });
const { ConfigService } = require('@nestjs/config');
const { AppConfig } = require('../dist/config/app-config');
const { LiteLlmGateway } = require('../dist/ai/model.gateway');
const {
  SCHEMA_PROMPT,
  MAPPING_PROMPT,
  JUDGE_PROMPT,
} = require('../dist/ai/prompts');
const {
  BASE_RESUME_SCHEMA,
  parseResumeSchema,
  validateResumeData,
  preservesFields,
} = require('../dist/contracts/resume-schema');
const { acceptsJudge } = require('../dist/contracts/workflow');
const { containsPii } = require('../dist/documents/pii');
async function main() {
  const model = new LiteLlmGateway(new AppConfig(new ConfigService()));
  const pii = {
    name: 'Synthetic Applicant',
    email: 'applicant@example.test',
    contactNumber: '+1 555 123 4567',
    location: 'Warsaw, Poland',
  };
  const source =
    'Software engineer. Example Labs, Developer, 2020 to 2024. Built internal tools with TypeScript, React and MongoDB. Education: Bachelor of Computer Science, Example University, 2019.';
  const schema = parseResumeSchema(
    await model.generate('worker', SCHEMA_PROMPT, {
      source,
      latestSchema: BASE_RESUME_SCHEMA,
    }),
  );
  if (containsPii(schema, pii)) throw new Error();
  const schemaJudge = await model.generate('judge', JUDGE_PROMPT, {
    stage: 'schema',
    source,
    latestSchema: BASE_RESUME_SCHEMA,
    candidate: schema,
  });
  if (
    !acceptsJudge(schemaJudge, 'schema', {
      structureValid: preservesFields(BASE_RESUME_SCHEMA, schema),
      piiAbsent: !containsPii(schemaJudge, pii),
    })
  )
    throw new Error();
  const data = await model.generate('worker', MAPPING_PROMPT, {
    source,
    schema,
  });
  if (containsPii(data, pii)) throw new Error();
  const mappingJudge = await model.generate('judge', JUDGE_PROMPT, {
    stage: 'mapping',
    source,
    schema,
    candidate: data,
  });
  if (
    !acceptsJudge(mappingJudge, 'mapping', {
      structureValid: validateResumeData(schema, data),
      piiAbsent: !containsPii(mappingJudge, pii),
    })
  )
    throw new Error();
  console.log(
    'PASS: configured worker/judge produce valid schema and mapping for synthetic source.',
  );
}
main().catch(() => {
  console.error(
    'FAIL: model configuration, transport, or acceptance checks; no source/provider response logged.',
  );
  process.exitCode = 1;
});
