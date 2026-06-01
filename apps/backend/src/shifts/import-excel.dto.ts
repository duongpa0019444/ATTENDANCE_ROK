export class ImportAssignmentDto {
  server_name: string;
  shift_name: string;
  start_time: string; // e.g. "08:00"
  work_date: string;  // "yyyy-MM-dd"
  user_ids: string[];
}

export class ImportExcelDto {
  week_start_date: string; // "yyyy-MM-dd"
  assignments: ImportAssignmentDto[];
}
