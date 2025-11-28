export interface PaginatedData<T> {
  total: number; // total number of items in DB
  page: number; // current page
  pageSize: number; // items per page
  hasNext: boolean; // is there a next page
  data: T[]; // actual items
}

export interface ApiResponse<T> {
  message: string;
  data: T | null;
  errors: {
    fieldErrors?: Record<string, string[]>;
    formErrors?: string[];
  } | null;
}

export interface ApiResponseQuery<T> {
  message: string;
  data: PaginatedData<T> | null;
  errors: {
    fieldErrors?: Record<string, string[]>;
    formErrors?: string[];
  } | null;
}

export type ApiRequestQuery = {
  page: number;
  pageSize: number;
};
