export interface FieldSpec {
  name: string;
  label?: string;
  widget?: string;
  required?: boolean;
  default?: unknown;
  options?: unknown;
  [key: string]: unknown;
}

export interface OptionSet {
  key: string;
  label?: string;
  options: unknown[];
  [key: string]: unknown;
}

export interface FormDefinition {
  formKey: string;
  actionId?: string;
  label?: string;
  stage?: string;
  fields?: FieldSpec[];
  [key: string]: unknown;
}

export interface ConfigFormEnvelope {
  configRequestId?: string;
  configRequestKey?: string;
  actionId?: string;
  stage?: string;
  nextConfigStage?: string | null;
  submitTool?: string;
  displayMode?: 'structured_content';
  formDefinitions?: Record<string, FormDefinition>;
  [key: string]: unknown;
}

export interface PendingConfigSession {
  key: string;
  requestId: string;
  label: string;
  submitTool: string;
  createdAt: number;
  kind?: 'single' | 'composite';
  stage?: string;
  entityIds?: string[];
  consumedEntityIds?: string[];
  partialSelections?: Record<string, unknown>;
  source?: 'form' | 'schema';
  forceNew?: boolean;
}
