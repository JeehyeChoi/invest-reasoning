export type CompanyFactsDocument = {
  cik?: string;
  entityName?: string;
  facts?: Record<
    string,
    Record<
      string,
      {
        label?: string;
        description?: string;
        units?: Record<string, any[]>;
      }
    >
  >;
};

export type FlatCompanyFactRow = {
  cik: string;
  entity_name: string | null;

  taxonomy: string;
  tag: string;
  unit: string;

  label: string | null;
  description: string | null;

  val: number | null;
  start: string | null;
  end: string | null;

  accn: string | null;
  fy: number | null;
  fp: string | null;
  form: string | null;
  filed: string | null;
  frame: string | null;

  workflow_type: string;
};
