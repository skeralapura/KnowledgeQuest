/**
 * lib/database.types.ts
 * Supabase database type definitions.
 * Run `supabase gen types typescript --project-id <ref>` to regenerate.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      students: {
        Row: {
          id: string;
          name: string;
          current_grade: number;
          interests: string[];
          preferred_format: string | null;
          streak_count: number;
          streak_freeze_remaining: number;
          last_active_date: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          current_grade: number;
          interests?: string[];
          preferred_format?: string | null;
          streak_count?: number;
          streak_freeze_remaining?: number;
          last_active_date?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          current_grade?: number;
          interests?: string[];
          preferred_format?: string | null;
          streak_count?: number;
          streak_freeze_remaining?: number;
          last_active_date?: string | null;
          created_at?: string;
        };
      };
      topics: {
        Row: {
          id: string;
          standard: string;
          name: string;
          description: string;
          grade: number;
          subject: string;
          diff_min: number;
          diff_max: number;
          question_formats: string[];
        };
        Insert: {
          id: string;
          standard: string;
          name: string;
          description: string;
          grade: number;
          subject: string;
          diff_min: number;
          diff_max: number;
          question_formats?: string[];
        };
        Update: Partial<Database["public"]["Tables"]["topics"]["Insert"]>;
      };
      topic_scores: {
        Row: {
          id: string;
          student_id: string;
          topic_id: string;
          confidence_score: number;
          attempts_count: number;
          correct_count: number;
          mastery_status: "learning" | "mastered" | "review_due" | "retained";
          last_attempted_at: string | null;
          mastered_at: string | null;
        };
        Insert: {
          id?: string;
          student_id: string;
          topic_id: string;
          confidence_score?: number;
          attempts_count?: number;
          correct_count?: number;
          mastery_status?: "learning" | "mastered" | "review_due" | "retained";
          last_attempted_at?: string | null;
          mastered_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["topic_scores"]["Insert"]>;
      };
      question_attempts: {
        Row: {
          id: string;
          student_id: string;
          topic_id: string;
          question_hash: string;
          question_format: string;
          difficulty_delivered: number;
          is_correct: boolean;
          time_to_answer_ms: number | null;
          reread_count: number;
          was_skipped: boolean;
          scenario_theme: string | null;
          prompt_template_id: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          topic_id: string;
          question_hash: string;
          question_format: string;
          difficulty_delivered: number;
          is_correct: boolean;
          time_to_answer_ms?: number | null;
          reread_count?: number;
          was_skipped?: boolean;
          scenario_theme?: string | null;
          prompt_template_id?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["question_attempts"]["Insert"]>;
      };
      question_seen: {
        Row: {
          id: string;
          student_id: string;
          question_hash: string;
          times_seen: number;
          last_was_correct: boolean;
          last_seen_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          question_hash: string;
          times_seen?: number;
          last_was_correct: boolean;
          last_seen_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["question_seen"]["Insert"]>;
      };
      session_events: {
        Row: {
          id: string;
          student_id: string;
          session_id: string;
          event_type: "question_shown" | "answer_submitted" | "session_quit" | "streak_extended";
          event_data: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          session_id: string;
          event_type: "question_shown" | "answer_submitted" | "session_quit" | "streak_extended";
          event_data?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["session_events"]["Insert"]>;
      };
      weekly_reports: {
        Row: {
          id: string;
          student_id: string;
          week_start: string;
          topics_attempted: Json;
          topics_mastered: Json;
          struggle_areas: Json;
          overall_accuracy: number | null;
          total_questions: number;
          streak_at_week_end: number;
          generated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          week_start: string;
          topics_attempted?: Json;
          topics_mastered?: Json;
          struggle_areas?: Json;
          overall_accuracy?: number | null;
          total_questions?: number;
          streak_at_week_end?: number;
          generated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["weekly_reports"]["Insert"]>;
      };
    };
    Functions: {
      compute_topic_score: {
        Args: { student_id: string; topic_id: string };
        Returns: void;
      };
      upsert_question_seen: {
        Args: { student_id: string; hash: string; was_correct: boolean };
        Returns: void;
      };
      compute_weekly_report: {
        Args: { student_id: string; week_start: string };
        Returns: void;
      };
    };
  };
}
