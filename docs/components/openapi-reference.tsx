import spec from '@/public/openapi.json';

type Json = Record<string, unknown>;
type Schema = Json & {
  type?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  enum?: unknown[];
  description?: string;
  $ref?: string;
  format?: string;
  default?: unknown;
};

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

function resolveRef(value: Schema | undefined): Schema {
  if (!value) return {};
  if (typeof value.$ref === 'string' && value.$ref.startsWith('#/')) {
    let current: unknown = spec;
    for (const part of value.$ref.slice(2).split('/')) {
      current = (current as Json)?.[part];
    }
    return (current as Schema) ?? {};
  }
  return value;
}

function typeLabel(schema: Schema): string {
  const resolved = resolveRef(schema);
  if (resolved.enum) return resolved.enum.map((item) => JSON.stringify(item)).join(' | ');
  if (resolved.type === 'array') return `${typeLabel(resolved.items ?? {})}[]`;
  if (resolved.type === 'integer') return resolved.format ? `integer (${resolved.format})` : 'integer';
  return resolved.type ?? 'object';
}

function schemaFields(schema: Schema | undefined) {
  const resolved = resolveRef(schema);
  const required = new Set(resolved.required ?? []);
  return Object.entries(resolved.properties ?? {}).map(([name, value]) => ({
    name,
    required: required.has(name),
    type: typeLabel(value),
    description: resolveRef(value).description ?? '',
    schema: value,
  }));
}

function sampleValue(name: string, schema: Schema): unknown {
  const resolved = resolveRef(schema);
  if (resolved.default !== undefined) return resolved.default;
  if (resolved.enum?.length) return resolved.enum[0];
  if (resolved.type === 'array') return [];
  if (resolved.type === 'integer' || resolved.type === 'number') {
    if (name.toLowerCase().includes('season')) return 1;
    if (name.toLowerCase().includes('episode')) return 1;
    if (name.toLowerCase().includes('ttl')) return 900;
    return 1;
  }
  if (resolved.type === 'boolean') return false;
  if (resolved.type === 'object') {
    return Object.fromEntries(
      Object.entries(resolved.properties ?? {}).map(([key, value]) => [key, sampleValue(key, value)]),
    );
  }
  if (name === 'type') return 'movie';
  if (name === 'id') return '27205';
  if (name === 'poster') return '/poster.jpg';
  return `string`;
}

function sampleObject(schema: Schema | undefined) {
  const resolved = resolveRef(schema);
  return Object.fromEntries(
    Object.entries(resolved.properties ?? {}).map(([name, value]) => [name, sampleValue(name, value)]),
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return <pre>{JSON.stringify(value, null, 2)}</pre>;
}

export function OpenApiReference() {
  const paths = (spec.paths ?? {}) as Record<string, Record<string, Json>>;
  const securitySchemes = (spec.components?.securitySchemes ?? {}) as Record<string, Json>;

  return (
    <div className="peak-api">
      <div className="peak-api-intro">
        <p>
          Base URL <code>{spec.servers?.[0]?.url ?? 'http://localhost:3000'}</code>. Every endpoint
          returns JSON unless it streams media or server-sent events. Embed session creation
          requires a partner API key in <code>x-api-key</code>.
        </p>
        <div className="peak-api-base">
          <strong>Authentication</strong>
          {Object.entries(securitySchemes).map(([name, scheme]) => (
            <code key={name}>
              {name}: {String(scheme.type)} / {String(scheme.scheme ?? scheme.in)}
            </code>
          ))}
        </div>
      </div>

      {Object.entries(paths).map(([path, operations]) => (
        <div className="peak-api-operation" key={path}>
          {METHODS.filter((method) => operations[method]).map((method) => {
            const operation = operations[method];
            const parameters = ((operation.parameters ?? []) as Schema[]).map(resolveRef);
            const requestBody = operation.requestBody as Json | undefined;
            const requestSchema =
              (requestBody?.content as Json | undefined)?.['application/json'] as Json | undefined;
            const requestFields = schemaFields(requestSchema?.schema as Schema | undefined);
            const responses = (operation.responses ?? {}) as Record<string, Json>;

            return (
              <section key={method}>
                <div className="peak-api-operation-head">
                  <span className={`peak-api-method ${method}`}>{method.toUpperCase()}</span>
                  <code className="peak-api-path">{path}</code>
                  <span className="peak-api-summary">{String(operation.summary ?? '')}</span>
                </div>
                <div className="peak-api-body">
                  {operation.description ? <p>{String(operation.description)}</p> : null}

                  {parameters.length > 0 ? (
                    <div>
                      <h4>Parameters</h4>
                      <table className="peak-api-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>In</th>
                            <th>Type</th>
                            <th>Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parameters.map((parameter) => (
                            <tr key={`${String(parameter.in)}-${String(parameter.name)}`}>
                              <td>
                                <code>{String(parameter.name)}</code>
                              </td>
                              <td>{String(parameter.in)}</td>
                              <td>{typeLabel(parameter.schema as Schema)}</td>
                              <td>{String(parameter.description ?? '')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  {requestFields.length > 0 ? (
                    <div>
                      <h4>Request body</h4>
                      <div className="peak-api-schema">
                        {requestFields.map((field) => (
                          <div className="peak-api-field" key={field.name}>
                            <code>
                              {field.name}
                              {field.required ? ' *' : ''}
                            </code>
                            <span>{field.type}</span>
                            <span>{field.description}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <JsonBlock value={sampleObject(requestSchema?.schema as Schema | undefined)} />
                      </div>
                    </div>
                  ) : null}

                  <div>
                    <h4>Responses</h4>
                    <div className="peak-api-response">
                      {Object.entries(responses).map(([status, response]) => {
                        const content = response.content as Json | undefined;
                        const responseSchema = (content?.['application/json'] as Json | undefined)
                          ?.schema as Schema | undefined;
                        return (
                          <div key={status}>
                            <div className="peak-api-response-head">
                              <span className="peak-api-status">{status}</span>
                              <span>{String(response.description ?? '')}</span>
                            </div>
                            {responseSchema ? (
                              <JsonBlock value={sampleObject(responseSchema)} />
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      ))}
    </div>
  );
}
