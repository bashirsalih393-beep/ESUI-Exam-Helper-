export type Role = "user" | "model" | "system";

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  attachments?: string[]; // base64 strings
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

export interface Course {
  id: string;
  name: string;
  creditUnits: number;
  score: number;
  grade: string;
  gradePoint: number;
}

export interface Semester {
  id: string;
  name: string;
  level: number; // 100, 200, ..., 600
  semesterType: 1 | 2; // 1st or 2nd semester
  courses: Course[];
  isManual?: boolean;
  manualGpa?: number;
  manualUnits?: number;
}

export interface AcademicRecord {
  semesters: Semester[];
}
