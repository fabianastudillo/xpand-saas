// Runtime validation against the same schemas that generate the types.
// Loaded only with createClient({ validate: true }) (development): ajv stays out of the production path.
import Ajv, { type ValidateFunction } from "ajv";
import catalogoSchema from "../../../contracts/api/catalogo.schema.json";
import configSchema from "../../../contracts/api/config.schema.json";
import redSchema from "../../../contracts/api/red.schema.json";
import sesionSchema from "../../../contracts/api/sesion.schema.json";

export type ContractName = "catalogo" | "red" | "config" | "sesion";

export interface SchemaValidator {
  /** Returns undefined when the body satisfies the contract; otherwise a text with the errors. */
  check(contract: ContractName, body: unknown): string | undefined;
}

export function createSchemaValidator(): SchemaValidator {
  // strictRequired is disabled: motor uses anyOf with required (formulacion or familia), which ajv flags spuriously.
  const ajv = new Ajv({ strict: true, strictRequired: false, allErrors: false });
  const validators: Record<ContractName, ValidateFunction> = {
    catalogo: ajv.compile(catalogoSchema),
    red: ajv.compile(redSchema),
    config: ajv.compile(configSchema),
    sesion: ajv.compile(sesionSchema),
  };
  return {
    check(contract, body) {
      const validate = validators[contract];
      if (validate(body)) return undefined;
      return ajv.errorsText(validate.errors);
    },
  };
}
