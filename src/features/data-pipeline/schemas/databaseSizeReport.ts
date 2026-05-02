export type DatabaseSizeReport = {
  database: {
    database_name: string;
    total_database_size: string;
    total_database_gb: number;
  };
  tables: {
    schema_name: string;
    table_name: string;
    table_size: string;
    index_size: string;
    total_size: string;
    total_size_gb: number;
  }[];
  largestIndexes: {
    table_name: string;
    index_name: string;
    index_size: string;
    index_size_gb: number;
  }[];
};
